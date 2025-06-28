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

  // Set bulan dan tahun saat ini saat komponen pertama kali dimuat
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
    const daysInMonth = new Date(Number.parseInt(selectedYear), Number.parseInt(selectedMonth), 0).getDate()
    const workingDays = Math.floor(daysInMonth * 0.75)

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

      const attendanceScore = persentaseKehadiran * 0.4
      const punctualityScore =
        emp.totalHadir > 0 ? ((emp.totalHadir - emp.totalTerlambat) / emp.totalHadir) * 100 * 0.3 : 0
      const consistencyScore = ((workingDays - emp.totalAlpha) / workingDays) * 100 * 0.3

      const performanceScore = attendanceScore + punctualityScore + consistencyScore

      return {
        ...emp,
        persentaseKehadiran: Math.round(persentaseKehadiran * 100) / 100,
        avgJamMasuk,
        performanceScore: Math.round(performanceScore * 100) / 100,
        rank: 0,
      }
    })

    statsArray.sort((a, b) => {
      if (b.performanceScore !== a.performanceScore) {
        return b.performanceScore - a.performanceScore
      }
      if (b.persentaseKehadiran !== a.persentaseKehadiran) {
        return b.persentaseKehadiran - a.persentaseKehadiran
      }
      if (a.totalTerlambat !== b.totalTerlambat) {
        return a.totalTerlambat - b.totalTerlambat
      }
      return a.nama.localeCompare(b.nama)
    })

    statsArray.forEach((emp, index) => {
      emp.rank = index + 1
    })

    setEmployeeStats(statsArray)
  }, [selectedMonth, selectedYear])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (selectedMonth && selectedYear) {
      fetchAttendanceData()
    }
  }, [selectedMonth, selectedYear, fetchAttendanceData])

  // ... semua return dan tampilan tetap sama
}
