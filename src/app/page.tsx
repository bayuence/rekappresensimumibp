"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@supabase/supabase-js"

// Supabase configuration
const supabaseUrl = "https://lotjsowqvlkfunocrbnd.supabase.co"
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvdGpzb3dxdmxrZnVub2NyYm5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg4MzUxMzUsImV4cCI6MjA2NDQxMTEzNX0.JsvnBMTo4xbT2W9V4FZ0Odh3FDA20hnSg-pBpVUAanM"
const supabase = createClient(supabaseUrl, supabaseKey)

interface AttendanceRecord {
  id: number
  nama: string
  tanggal: string
  jam_masuk: string
  jam_keluar: string | null
  status: string
  keterangan: string | null
}

interface EmployeeStats {
  nama: string
  totalHadir: number
  totalTerlambat: number
  totalAlpha: number
  totalIzin: number
  totalSakit: number
  persentaseKehadiran: number
  avgJamMasuk: string
  totalWorkingDays: number
  performanceScore: number
  rank: number
}

export default function Dashboard() {
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([])
  const [employeeStats, setEmployeeStats] = useState<EmployeeStats[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState("")
  const [selectedYear, setSelectedYear] = useState("")

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      // Mobile detection logic can be added here if needed
      // setIsMobile(window.innerWidth < 768)
    }

    // Check on mount
    checkMobile()

    // Add event listener
    window.addEventListener("resize", checkMobile)

    // Cleanup
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  useEffect(() => {
    const currentDate = new Date()
    setSelectedMonth(String(currentDate.getMonth() + 1).padStart(2, "0"))
    setSelectedYear(String(currentDate.getFullYear()))
  }, [])

  const fetchAttendanceData = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("presensi")
        .select("*")
        .gte("tanggal", `${selectedYear}-${selectedMonth}-01`)
        .lt("tanggal", `${selectedYear}-${String(Number.parseInt(selectedMonth) + 1).padStart(2, "0")}-01`)
        .order("tanggal", { ascending: false })

      if (error) throw error
      setAttendanceData(data || [])
      calculateEmployeeStats(data || [])
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setLoading(false)
    }
  }, [selectedMonth, selectedYear])

  const calculateEmployeeStats = useCallback((data: AttendanceRecord[]) => {
    const employeeMap = new Map<string, any>()

    // Get working days in selected month
    const daysInMonth = new Date(Number.parseInt(selectedYear), Number.parseInt(selectedMonth), 0).getDate()
    const workingDays = Math.floor(daysInMonth * 0.75) // Assuming ~75% are working days

    data.forEach((record) => {
      const nama = record.nama
      if (!employeeMap.has(nama)) {
        employeeMap.set(nama, {
          nama,
          totalHadir: 0,
          totalTerlambat: 0,
          totalAlpha: 0,
          totalIzin: 0,
          totalSakit: 0,
          jamMasukTotal: 0,
          jamMasukCount: 0,
          totalWorkingDays: workingDays,
        })
      }

      const employee = employeeMap.get(nama)

      switch (record.status.toLowerCase()) {
        case "hadir":
          employee.totalHadir++
          if (record.jam_masuk) {
            const jamMasuk = new Date(`2000-01-01 ${record.jam_masuk}`)
            const jamStandar = new Date(`2000-01-01 08:00:00`)
            if (jamMasuk > jamStandar) {
              employee.totalTerlambat++
            }
            employee.jamMasukTotal += jamMasuk.getHours() + jamMasuk.getMinutes() / 60
            employee.jamMasukCount++
          }
          break
        case "alpha":
          employee.totalAlpha++
          break
        case "izin":
          employee.totalIzin++
          break
        case "sakit":
          employee.totalSakit++
          break
      }
    })

    const statsArray: EmployeeStats[] = Array.from(employeeMap.values()).map((emp) => {
      const persentaseKehadiran = workingDays > 0 ? (emp.totalHadir / workingDays) * 100 : 0
      const avgJamMasuk =
        emp.jamMasukCount > 0
          ? `${Math.floor(emp.jamMasukTotal / emp.jamMasukCount)}:${String(Math.round(((emp.jamMasukTotal / emp.jamMasukCount) % 1) * 60)).padStart(2, "0")}`
          : "00:00"

      // Multi-criteria performance scoring
      const attendanceScore = persentaseKehadiran * 0.4 // 40% weight
      const punctualityScore =
        emp.totalHadir > 0 ? ((emp.totalHadir - emp.totalTerlambat) / emp.totalHadir) * 100 * 0.3 : 0 // 30% weight
      const consistencyScore = ((workingDays - emp.totalAlpha) / workingDays) * 100 * 0.3 // 30% weight

      const performanceScore = attendanceScore + punctualityScore + consistencyScore

      return {
        ...emp,
        persentaseKehadiran: Math.round(persentaseKehadiran * 100) / 100,
        avgJamMasuk,
        performanceScore: Math.round(performanceScore * 100) / 100,
        rank: 0, // Will be set after sorting
      }
    })

    // Sort by performance score (descending) and set ranks
    statsArray.sort((a, b) => {
      if (b.performanceScore !== a.performanceScore) {
        return b.performanceScore - a.performanceScore
      }
      // Tie-breaker 1: Higher attendance percentage
      if (b.persentaseKehadiran !== a.persentaseKehadiran) {
        return b.persentaseKehadiran - a.persentaseKehadiran
      }
      // Tie-breaker 2: Lower tardiness
      if (a.totalTerlambat !== b.totalTerlambat) {
        return a.totalTerlambat - b.totalTerlambat
      }
      // Tie-breaker 3: Alphabetical order
      return a.nama.localeCompare(b.nama)
    })

    // Assign ranks
    statsArray.forEach((emp, index) => {
      emp.rank = index + 1
    })

    setEmployeeStats(statsArray)
  }, [selectedMonth, selectedYear])

  useEffect(() => {
    if (selectedMonth && selectedYear) {
      fetchAttendanceData()
    }
  }, [selectedMonth, selectedYear, fetchAttendanceData])

  const getTopPerformer = () => {
    if (employeeStats.length === 0) return null
    return employeeStats[0]
  }

  const getTopPerformerExplanation = () => {
    const topPerformer = getTopPerformer()
    if (!topPerformer) return ""

    const reasons = []
    reasons.push(`Skor Performa: ${topPerformer.performanceScore}`)
    reasons.push(`Kehadiran: ${topPerformer.persentaseKehadiran}%`)
    reasons.push(`Keterlambatan: ${topPerformer.totalTerlambat} hari`)

    return `Dipilih berdasarkan: ${reasons.join(", ")}`
  }

  const monthNames = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Memuat data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-lg border-b-4 border-blue-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">📊 Dashboard Presensi</h1>
              <p className="text-sm sm:text-base text-gray-600 mt-1">MUMI BP KULON - Monitoring Kehadiran Karyawan</p>
            </div>

            {/* Month/Year Selector */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                {monthNames.map((month, index) => (
                  <option key={index} value={String(index + 1).padStart(2, "0")}>
                    {month}
                  </option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                {[2023, 2024, 2025].map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Top Performer Card */}
        {getTopPerformer() && (
          <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-xl shadow-lg p-4 sm:p-6 mb-6 sm:mb-8 text-white">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg sm:text-xl font-bold mb-2">🏆 Top Performer</h2>
                <p className="text-xl sm:text-2xl font-bold">{getTopPerformer()?.nama}</p>
                <p className="text-sm sm:text-base opacity-90 mt-1">
                  Kehadiran: {getTopPerformer()?.persentaseKehadiran}% | Skor: {getTopPerformer()?.performanceScore}
                </p>
              </div>
              <div className="text-xs sm:text-sm bg-white/20 rounded-lg p-3">
                <p className="font-semibold mb-1">Kriteria Penilaian:</p>
                <p>{getTopPerformerExplanation()}</p>
              </div>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-600">Total Karyawan</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{employeeStats.length}</p>
              </div>
              <div className="bg-blue-100 p-2 sm:p-3 rounded-full">
                <span className="text-lg sm:text-xl">👥</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-600">Rata-rata Kehadiran</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">
                  {employeeStats.length > 0
                    ? Math.round(
                        employeeStats.reduce((acc, emp) => acc + emp.persentaseKehadiran, 0) / employeeStats.length,
                      )
                    : 0}
                  %
                </p>
              </div>
              <div className="bg-green-100 p-2 sm:p-3 rounded-full">
                <span className="text-lg sm:text-xl">📈</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-600">Total Keterlambatan</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">
                  {employeeStats.reduce((acc, emp) => acc + emp.totalTerlambat, 0)}
                </p>
              </div>
              <div className="bg-yellow-100 p-2 sm:p-3 rounded-full">
                <span className="text-lg sm:text-xl">⏰</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border-l-4 border-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-600">Total Alpha</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">
                  {employeeStats.reduce((acc, emp) => acc + emp.totalAlpha, 0)}
                </p>
              </div>
              <div className="bg-red-100 p-2 sm:p-3 rounded-full">
                <span className="text-lg sm:text-xl">❌</span>
              </div>
            </div>
          </div>
        </div>

        {/* Employee Statistics Table */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900">
              📋 Statistik Karyawan - {monthNames[Number.parseInt(selectedMonth) - 1]} {selectedYear}
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nama
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Skor
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Kehadiran
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Hadir
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Terlambat
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Alpha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Izin
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sakit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg Masuk
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {employeeStats.map((employee, index) => (
                  <tr key={employee.nama} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {employee.rank === 1 && <span className="text-lg mr-1">🥇</span>}
                        {employee.rank === 2 && <span className="text-lg mr-1">🥈</span>}
                        {employee.rank === 3 && <span className="text-lg mr-1">🥉</span>}
                        <span className="text-sm font-medium text-gray-900">#{employee.rank}</span>
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{employee.nama}</div>
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                        {employee.performanceScore}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="text-sm font-medium text-gray-900">{employee.persentaseKehadiran}%</div>
                        <div className="ml-2 w-16 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-green-500 h-2 rounded-full"
                            style={{ width: `${Math.min(employee.persentaseKehadiran, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{employee.totalHadir}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{employee.totalTerlambat}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{employee.totalAlpha}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{employee.totalIzin}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{employee.totalSakit}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{employee.avgJamMasuk}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Attendance Records */}
        <div className="mt-6 sm:mt-8 bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900">📅 Data Presensi Terbaru</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nama
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tanggal
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Jam Masuk
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Jam Keluar
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Keterangan
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {attendanceData.slice(0, 10).map((record, index) => (
                  <tr key={record.id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{record.nama}</div>
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(record.tanggal).toLocaleDateString("id-ID")}
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          record.status.toLowerCase() === "hadir"
                            ? "bg-green-100 text-green-800"
                            : record.status.toLowerCase() === "alpha"
                              ? "bg-red-100 text-red-800"
                              : record.status.toLowerCase() === "izin"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {record.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.jam_masuk || "-"}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {record.jam_keluar || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {record.keterangan || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}