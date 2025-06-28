"use client"
import { useEffect, useState } from "react"
import { createClient } from "@supabase/supabase-js"

// Supabase client menggunakan environment variables
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

interface AbsensiRecord {
  username: string
  nama: string
  tanggal: string
  status: string
  jam_masuk?: string
  created_at?: string
}

interface RekapData {
  nama: string
  jumlahHadir: number
  jumlahTidakHadir: number
  persentaseHadir: number
}

export default function PresensiDashboard() {
  const [hadirHariIni, setHadirHariIni] = useState<AbsensiRecord[]>([])
  const [rekap, setRekap] = useState<RekapData[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [bulan, setBulan] = useState<number>(new Date().getMonth())
  const [tahun, setTahun] = useState<number>(new Date().getFullYear())
  const [today, setToday] = useState("")
  const [currentTime, setCurrentTime] = useState(new Date())
  const [scrollY, setScrollY] = useState(0)
  const [isMobile, setIsMobile] = useState(false)

  const bulanNama = new Date(tahun, bulan).toLocaleString("id-ID", { month: "long" })

  // Handle mobile detection safely
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768)
    }

    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  // Handle scroll for navbar
  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY)
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const now = new Date()
    setToday(now.toISOString().split("T")[0])
  }, [])

  useEffect(() => {
    if (!today) return
    fetchHadirHariIni()
  }, [today])

  useEffect(() => {
    fetchRekap()
  }, [bulan, tahun])

  const fetchHadirHariIni = async () => {
    setIsRefreshing(true)
    try {
      const { data: hadirData, error } = await supabase
        .from("absensi")
        .select("*")
        .eq("tanggal", today)
        .eq("status", "HADIR")
        .order("id", { ascending: true })

      if (error) {
        console.error("Error fetching attendance:", error)
        setHadirHariIni([])
        return
      }

      const processedData =
        hadirData?.map((item) => ({
          ...item,
          nama: item.nama.toUpperCase(),
          jam_masuk:
            item.jam_masuk ??
            (item.created_at
              ? new Date(item.created_at).toLocaleTimeString("id-ID", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "-"),
        })) || []

      processedData.sort((a, b) => a.nama.localeCompare(b.nama))
      setHadirHariIni(processedData)
    } catch (err) {
      console.error("Catch error:", err)
      setHadirHariIni([])
    } finally {
      setIsRefreshing(false)
    }
  }

  const fetchRekap = async () => {
    const startDate = new Date(tahun, bulan, 1).toISOString().split("T")[0]
    const endDate = new Date(tahun, bulan + 1, 0).toISOString().split("T")[0]

    try {
      const { data: semuaUser } = await supabase.from("users").select("*")
      const { data: semuaAbsen } = await supabase
        .from("absensi")
        .select("*")
        .gte("tanggal", startDate)
        .lte("tanggal", endDate)

      const hasil = semuaUser?.map((u) => {
        const userAbsen = semuaAbsen?.filter((a) => a.username === u.username) || []
        const jumlahHadir = userAbsen.filter((a) => a.status === "HADIR").length
        const jumlahTidakHadir = userAbsen.filter((a) => a.status === "TIDAK_HADIR").length
        const totalAbsensi = jumlahHadir + jumlahTidakHadir
        const persentaseHadir = totalAbsensi > 0 ? Math.round((jumlahHadir / totalAbsensi) * 100) : 0

        return {
          nama: u.nama.toUpperCase(),
          jumlahHadir,
          jumlahTidakHadir,
          persentaseHadir,
        }
      })

      hasil?.sort((a, b) => a.nama.localeCompare(b.nama))
      setRekap(hasil || [])
    } catch (error) {
      console.error("Error fetching rekap:", error)
      setRekap([])
    }
  }

  const navigateBulan = (direction: "prev" | "next") => {
    if (direction === "prev") {
      if (bulan === 0) {
        setBulan(11)
        setTahun(tahun - 1)
      } else {
        setBulan(bulan - 1)
      }
    } else {
      if (bulan === 11) {
        setBulan(0)
        setTahun(tahun + 1)
      } else {
        setBulan(bulan + 1)
      }
    }
  }

  const goToCurrentMonth = () => {
    const now = new Date()
    setBulan(now.getMonth())
    setTahun(now.getFullYear())
  }

  const getGreeting = () => {
    const hour = currentTime.getHours()
    if (hour < 12) return "Selamat Pagi"
    if (hour < 15) return "Selamat Siang"
    if (hour < 18) return "Selamat Sore"
    return "Selamat Malam"
  }

  const getPerformanceColor = (percentage: number) => {
    if (percentage >= 90) return "#10b981"
    if (percentage >= 80) return "#3b82f6"
    if (percentage >= 70) return "#f59e0b"
    return "#ef4444"
  }

  const getPerformanceStatus = (percentage: number) => {
    if (percentage >= 90) return "EXCELLENT"
    if (percentage >= 80) return "GOOD"
    if (percentage >= 70) return "FAIR"
    return "POOR"
  }

  const totalRemaja = rekap.length
  const avgKehadiran =
    rekap.length > 0 ? Math.round(rekap.reduce((sum, item) => sum + item.persentaseHadir, 0) / rekap.length) : 0

  // Ganti bagian perhitungan topPerformer dengan sistem ranking yang lebih adil
  const getTopPerformerWithReason = () => {
    if (rekap.length === 0) return null

    // Cari semua dengan persentase tertinggi
    const maxPercentage = Math.max(...rekap.map((item) => item.persentaseHadir))
    const topCandidates = rekap.filter((item) => item.persentaseHadir === maxPercentage)

    if (topCandidates.length === 1) {
      return {
        ...topCandidates[0],
        reason: `Persentase tertinggi ${maxPercentage}%`,
        reasonDetail: "Unggul dalam persentase kehadiran",
      }
    }

    // Jika ada tie, gunakan total hari hadir sebagai tie-breaker
    const maxHadir = Math.max(...topCandidates.map((item) => item.jumlahHadir))
    const finalCandidates = topCandidates.filter((item) => item.jumlahHadir === maxHadir)

    if (finalCandidates.length === 1) {
      return {
        ...finalCandidates[0],
        reason: `${maxPercentage}% + ${maxHadir} hari hadir terbanyak`,
        reasonDetail: `Dari ${topCandidates.length} orang dengan ${maxPercentage}%, unggul dengan ${maxHadir} hari hadir`,
      }
    }

    // Jika masih tie, ambil yang pertama (berdasarkan urutan alfabetis)
    const winner = finalCandidates[0]
    return {
      ...winner,
      reason: `${maxPercentage}% + ${maxHadir} hari (urutan alfabetis)`,
      reasonDetail: `Dari ${finalCandidates.length} orang dengan performa identik, dipilih berdasarkan urutan alfabetis`,
    }
  }

  const topPerformerData = getTopPerformerWithReason()

  const isCurrentMonth = bulan === new Date().getMonth() && tahun === new Date().getFullYear()

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `
          radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.3) 0%, transparent 50%),
          radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.3) 0%, transparent 50%),
          radial-gradient(circle at 40% 40%, rgba(120, 219, 255, 0.3) 0%, transparent 50%),
          linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)
        `,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Floating Background Elements */}
      <div
        style={{
          position: "fixed",
          top: "10%",
          left: "5%",
          width: "300px",
          height: "300px",
          background: "radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)",
          borderRadius: "50%",
          animation: "float 6s ease-in-out infinite",
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: "fixed",
          top: "60%",
          right: "10%",
          width: "200px",
          height: "200px",
          background: "radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)",
          borderRadius: "50%",
          animation: "float 8s ease-in-out infinite reverse",
          zIndex: 0,
        }}
      />

      {/* Ultra Modern Navbar */}
      <nav
        style={{
          background: scrollY > 50 ? "rgba(255, 255, 255, 0.25)" : "rgba(255, 255, 255, 0.15)",
          backdropFilter: "blur(30px)",
          borderBottom: `1px solid rgba(255, 255, 255, ${scrollY > 50 ? 0.4 : 0.2})`,
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          boxShadow: scrollY > 50 ? "0 20px 40px rgba(0, 0, 0, 0.15)" : "0 8px 32px rgba(0, 0, 0, 0.1)",
          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          transform: scrollY > 100 ? "translateY(0)" : "translateY(0)",
        }}
      >
        <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "0 24px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              height: "80px",
              gap: "20px",
            }}
          >
            {/* Logo & Title */}
            <div style={{ display: "flex", alignItems: "center", gap: "16px", flex: "1", minWidth: "0" }}>
              <div
                style={{
                  width: "60px",
                  height: "60px",
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)",
                  borderRadius: "20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "28px",
                  boxShadow: "0 10px 30px rgba(102, 126, 234, 0.4)",
                  flexShrink: 0,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.2) 50%, transparent 70%)",
                    animation: "shimmer 3s infinite",
                  }}
                />
                🕌
              </div>
              <div style={{ minWidth: "0", flex: "1" }}>
                <h1
                  style={{
                    fontSize: "clamp(20px, 4vw, 28px)",
                    fontWeight: "900",
                    color: "white",
                    margin: 0,
                    lineHeight: "1.2",
                    background: "linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    textShadow: "0 2px 10px rgba(0,0,0,0.3)",
                    letterSpacing: "0.5px",
                  }}
                >
                  MUMI BP KULON
                </h1>
                <p
                  className="hidden sm:block"
                  style={{
                    color: "rgba(255, 255, 255, 0.9)",
                    fontSize: "14px",
                    margin: 0,
                    fontWeight: "500",
                  }}
                >
                  Dashboard Presensi Digital
                </p>
              </div>
            </div>

            {/* Time & Date */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  background: "rgba(255, 255, 255, 0.2)",
                  backdropFilter: "blur(20px)",
                  borderRadius: "16px",
                  padding: "12px 16px",
                  border: "1px solid rgba(255, 255, 255, 0.3)",
                  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",
                }}
              >
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    borderRadius: "12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "18px",
                    boxShadow: "0 4px 16px rgba(16, 185, 129, 0.3)",
                  }}
                >
                  🕐
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ color: "white", fontWeight: "bold", fontSize: "16px", margin: 0 }}>
                    {currentTime.toLocaleTimeString("id-ID", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  <p
                    className="hidden md:block"
                    style={{
                      color: "rgba(255, 255, 255, 0.8)",
                      fontSize: "12px",
                      margin: 0,
                    }}
                  >
                    {getGreeting()}
                  </p>
                </div>
              </div>

              <div
                className="hidden sm:flex"
                style={{
                  background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                  borderRadius: "16px",
                  padding: "12px 16px",
                  boxShadow: "0 8px 32px rgba(245, 158, 11, 0.3)",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span style={{ fontSize: "16px" }}>📅</span>
                <span style={{ color: "white", fontWeight: "bold", fontSize: "14px" }}>
                  {new Date().toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div
        style={{ maxWidth: "1400px", margin: "0 auto", padding: "120px 24px 40px", position: "relative", zIndex: 1 }}
      >
        {/* Ultra Modern Stats Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "32px",
            marginBottom: "48px",
          }}
        >
          {/* Hadir Hari Ini Card */}
          <div
            className="stats-card"
            style={{
              background: "rgba(255, 255, 255, 0.1)",
              backdropFilter: "blur(30px)",
              borderRadius: "28px",
              padding: "32px",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              boxShadow: "0 25px 50px rgba(0, 0, 0, 0.1)",
              cursor: "pointer",
              transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
              position: "relative",
              overflow: "hidden",
              transform: "translateY(0)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-12px) scale(1.02)"
              e.currentTarget.style.boxShadow = "0 35px 70px rgba(0, 0, 0, 0.2)"
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0) scale(1)"
              e.currentTarget.style.boxShadow = "0 25px 50px rgba(0, 0, 0, 0.1)"
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)"
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "4px",
                background: "linear-gradient(90deg, #3b82f6, #1d4ed8, #3b82f6)",
                backgroundSize: "200% 100%",
                animation: "gradient-x 3s ease infinite",
              }}
            />

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "24px",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "20px" }}>
                  <div
                    style={{
                      width: "72px",
                      height: "72px",
                      background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
                      borderRadius: "24px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "32px",
                      boxShadow: "0 12px 40px rgba(59, 130, 246, 0.4)",
                      position: "relative",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        inset: "2px",
                        background: "linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 100%)",
                        borderRadius: "22px",
                      }}
                    />
                    👥
                  </div>
                  <div>
                    <h3
                      style={{
                        color: "white",
                        fontSize: "20px",
                        fontWeight: "800",
                        margin: 0,
                        textShadow: "0 2px 10px rgba(0,0,0,0.3)",
                      }}
                    >
                      HADIR HARI INI
                    </h3>
                    <p
                      style={{
                        color: "rgba(255, 255, 255, 0.8)",
                        fontSize: "14px",
                        margin: "4px 0 0 0",
                        fontWeight: "500",
                      }}
                    >
                      Real-time Update
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "baseline", gap: "12px", marginBottom: "16px" }}>
                  <span
                    style={{
                      color: "white",
                      fontSize: "56px",
                      fontWeight: "900",
                      lineHeight: "1",
                      textShadow: "0 4px 20px rgba(0,0,0,0.3)",
                    }}
                  >
                    {hadirHariIni.length}
                  </span>
                  <span style={{ color: "rgba(255, 255, 255, 0.8)", fontSize: "18px", fontWeight: "700" }}>REMAJA</span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div
                    style={{
                      width: "12px",
                      height: "12px",
                      background: "#10b981",
                      borderRadius: "50%",
                      animation: "pulse-glow 2s infinite",
                      boxShadow: "0 0 20px rgba(16, 185, 129, 0.6)",
                    }}
                  />
                  <span
                    style={{
                      color: "#10b981",
                      fontSize: "16px",
                      fontWeight: "700",
                      textShadow: "0 2px 10px rgba(0,0,0,0.3)",
                    }}
                  >
                    LIVE UPDATE
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Total Terdaftar Card */}
          <div
            className="stats-card"
            style={{
              background: "rgba(255, 255, 255, 0.1)",
              backdropFilter: "blur(30px)",
              borderRadius: "28px",
              padding: "32px",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              boxShadow: "0 25px 50px rgba(0, 0, 0, 0.1)",
              cursor: "pointer",
              transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
              position: "relative",
              overflow: "hidden",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-12px) scale(1.02)"
              e.currentTarget.style.boxShadow = "0 35px 70px rgba(0, 0, 0, 0.2)"
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0) scale(1)"
              e.currentTarget.style.boxShadow = "0 25px 50px rgba(0, 0, 0, 0.1)"
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)"
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "4px",
                background: "linear-gradient(90deg, #10b981, #059669, #10b981)",
                backgroundSize: "200% 100%",
                animation: "gradient-x 3s ease infinite",
              }}
            />

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "24px",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "20px" }}>
                  <div
                    style={{
                      width: "72px",
                      height: "72px",
                      background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                      borderRadius: "24px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "32px",
                      boxShadow: "0 12px 40px rgba(16, 185, 129, 0.4)",
                      position: "relative",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        inset: "2px",
                        background: "linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 100%)",
                        borderRadius: "22px",
                      }}
                    />
                    📊
                  </div>
                  <div>
                    <h3
                      style={{
                        color: "white",
                        fontSize: "20px",
                        fontWeight: "800",
                        margin: 0,
                        textShadow: "0 2px 10px rgba(0,0,0,0.3)",
                      }}
                    >
                      TOTAL TERDAFTAR
                    </h3>
                    <p
                      style={{
                        color: "rgba(255, 255, 255, 0.8)",
                        fontSize: "14px",
                        margin: "4px 0 0 0",
                        fontWeight: "500",
                      }}
                    >
                      {totalRemaja} Remaja Aktif
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "baseline", gap: "12px", marginBottom: "16px" }}>
                  <span
                    style={{
                      color: "white",
                      fontSize: "56px",
                      fontWeight: "900",
                      lineHeight: "1",
                      textShadow: "0 4px 20px rgba(0,0,0,0.3)",
                    }}
                  >
                    {totalRemaja}
                  </span>
                  <span style={{ color: "rgba(255, 255, 255, 0.8)", fontSize: "18px", fontWeight: "700" }}>REMAJA</span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span
                    style={{
                      color: "#10b981",
                      fontSize: "16px",
                      fontWeight: "700",
                      textShadow: "0 2px 10px rgba(0,0,0,0.3)",
                    }}
                  >
                    ✅ AKTIF TERDAFTAR
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Rata-rata Kehadiran Card */}
          <div
            className="stats-card"
            style={{
              background: "rgba(255, 255, 255, 0.1)",
              backdropFilter: "blur(30px)",
              borderRadius: "28px",
              padding: "32px",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              boxShadow: "0 25px 50px rgba(0, 0, 0, 0.1)",
              cursor: "pointer",
              transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
              position: "relative",
              overflow: "hidden",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-12px) scale(1.02)"
              e.currentTarget.style.boxShadow = "0 35px 70px rgba(0, 0, 0, 0.2)"
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0) scale(1)"
              e.currentTarget.style.boxShadow = "0 25px 50px rgba(0, 0, 0, 0.1)"
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)"
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "4px",
                background: "linear-gradient(90deg, #a855f7, #7c3aed, #a855f7)",
                backgroundSize: "200% 100%",
                animation: "gradient-x 3s ease infinite",
              }}
            />

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "24px",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "20px" }}>
                  <div
                    style={{
                      width: "72px",
                      height: "72px",
                      background: "linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)",
                      borderRadius: "24px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "32px",
                      boxShadow: "0 12px 40px rgba(168, 85, 247, 0.4)",
                      position: "relative",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        inset: "2px",
                        background: "linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 100%)",
                        borderRadius: "22px",
                      }}
                    />
                    🎯
                  </div>
                  <div>
                    <h3
                      style={{
                        color: "white",
                        fontSize: "20px",
                        fontWeight: "800",
                        margin: 0,
                        textShadow: "0 2px 10px rgba(0,0,0,0.3)",
                      }}
                    >
                      RATA-RATA KEHADIRAN
                    </h3>
                    <p
                      style={{
                        color: "rgba(255, 255, 255, 0.8)",
                        fontSize: "14px",
                        margin: "4px 0 0 0",
                        fontWeight: "500",
                      }}
                    >
                      {bulanNama} {tahun}
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "baseline", gap: "12px", marginBottom: "16px" }}>
                  <span
                    style={{
                      color: "white",
                      fontSize: "56px",
                      fontWeight: "900",
                      lineHeight: "1",
                      textShadow: "0 4px 20px rgba(0,0,0,0.3)",
                    }}
                  >
                    {avgKehadiran}
                  </span>
                  <span style={{ color: "rgba(255, 255, 255, 0.8)", fontSize: "28px", fontWeight: "700" }}>%</span>
                </div>

                <div style={{ marginTop: "16px" }}>
                  <div
                    style={{
                      width: "100%",
                      height: "12px",
                      background: "rgba(255, 255, 255, 0.2)",
                      borderRadius: "6px",
                      overflow: "hidden",
                      position: "relative",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        background: "linear-gradient(90deg, #a855f7, #7c3aed)",
                        width: `${avgKehadiran}%`,
                        borderRadius: "6px",
                        transition: "width 2s cubic-bezier(0.4, 0, 0.2, 1)",
                        boxShadow: "0 0 20px rgba(168, 85, 247, 0.5)",
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Top Performer Card */}
          <div
            className="stats-card"
            style={{
              background: "rgba(255, 255, 255, 0.1)",
              backdropFilter: "blur(30px)",
              borderRadius: "28px",
              padding: "32px",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              boxShadow: "0 25px 50px rgba(0, 0, 0, 0.1)",
              cursor: "pointer",
              transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
              position: "relative",
              overflow: "hidden",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-12px) scale(1.02)"
              e.currentTarget.style.boxShadow = "0 35px 70px rgba(0, 0, 0, 0.2)"
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0) scale(1)"
              e.currentTarget.style.boxShadow = "0 25px 50px rgba(0, 0, 0, 0.1)"
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)"
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "4px",
                background: "linear-gradient(90deg, #f59e0b, #d97706, #f59e0b)",
                backgroundSize: "200% 100%",
                animation: "gradient-x 3s ease infinite",
              }}
            />

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "24px",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "20px" }}>
                  <div
                    style={{
                      width: "72px",
                      height: "72px",
                      background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                      borderRadius: "24px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "32px",
                      boxShadow: "0 12px 40px rgba(245, 158, 11, 0.4)",
                      position: "relative",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        inset: "2px",
                        background: "linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 100%)",
                        borderRadius: "22px",
                      }}
                    />
                    🏆
                  </div>
                  <div>
                    <h3
                      style={{
                        color: "white",
                        fontSize: "20px",
                        fontWeight: "800",
                        margin: 0,
                        textShadow: "0 2px 10px rgba(0,0,0,0.3)",
                      }}
                    >
                      TOP PERFORMER
                    </h3>
                    <p
                      style={{
                        color: "rgba(255, 255, 255, 0.8)",
                        fontSize: "14px",
                        margin: "4px 0 0 0",
                        fontWeight: "500",
                      }}
                    >
                      Terbaik Bulan Ini
                    </p>
                  </div>
                </div>

                {/* Top Performer Card - Update bagian content */}
                <div style={{ marginBottom: "12px" }}>
                  <span
                    style={{
                      color: "white",
                      fontSize: "22px",
                      fontWeight: "bold",
                      display: "block",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      textShadow: "0 2px 10px rgba(0,0,0,0.3)",
                    }}
                  >
                    {topPerformerData?.nama || "BELUM ADA DATA"}
                  </span>
                  {topPerformerData && (
                    <div style={{ marginTop: "8px" }}>
                      <div
                        style={{
                          background: "rgba(255, 255, 255, 0.15)",
                          borderRadius: "12px",
                          padding: "8px 12px",
                          border: "1px solid rgba(255, 255, 255, 0.2)",
                          marginBottom: "6px",
                        }}
                      >
                        <span
                          style={{
                            color: "rgba(255, 255, 255, 0.9)",
                            fontSize: "12px",
                            fontWeight: "600",
                            display: "block",
                            lineHeight: "1.3",
                          }}
                        >
                          🏆 {topPerformerData.reason}
                        </span>
                      </div>
                      <span
                        style={{
                          color: "rgba(255, 255, 255, 0.8)",
                          fontSize: "11px",
                          fontWeight: "500",
                          lineHeight: "1.3",
                          display: "block",
                        }}
                      >
                        {topPerformerData.reasonDetail}
                      </span>
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span
                    style={{
                      color: "white",
                      fontSize: "32px",
                      fontWeight: "900",
                      textShadow: "0 2px 10px rgba(0,0,0,0.3)",
                    }}
                  >
                    {topPerformerData?.persentaseHadir || 0}%
                  </span>
                  <span style={{ fontSize: "24px", animation: "bounce 2s infinite" }}>⭐</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Ultra Modern Kehadiran Hari Ini */}
        <div
          style={{
            background: "rgba(255, 255, 255, 0.1)",
            backdropFilter: "blur(30px)",
            borderRadius: "32px",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            boxShadow: "0 25px 50px rgba(0, 0, 0, 0.1)",
            marginBottom: "48px",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "6px",
              background: "linear-gradient(90deg, #3b82f6, #1d4ed8, #3b82f6)",
              backgroundSize: "200% 100%",
              animation: "gradient-x 3s ease infinite",
            }}
          />

          <div
            style={{
              background: "linear-gradient(135deg, rgba(59, 130, 246, 0.9) 0%, rgba(29, 78, 216, 0.9) 100%)",
              padding: "32px",
              borderBottom: "1px solid rgba(255, 255, 255, 0.2)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "20px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                <div
                  style={{
                    width: "64px",
                    height: "64px",
                    background: "rgba(255, 255, 255, 0.2)",
                    borderRadius: "20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "28px",
                    backdropFilter: "blur(10px)",
                  }}
                >
                  👥
                </div>
                <div>
                  <h2
                    style={{
                      color: "white",
                      fontSize: "32px",
                      fontWeight: "900",
                      margin: 0,
                      textShadow: "0 4px 20px rgba(0,0,0,0.3)",
                    }}
                  >
                    KEHADIRAN HARI INI
                  </h2>
                  <p
                    style={{
                      color: "rgba(255, 255, 255, 0.9)",
                      fontSize: "16px",
                      margin: "8px 0 0 0",
                      fontWeight: "500",
                    }}
                  >
                    {new Date().toLocaleDateString("id-ID", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>
              <button
                onClick={fetchHadirHariIni}
                disabled={isRefreshing}
                style={{
                  background: "rgba(255, 255, 255, 0.2)",
                  backdropFilter: "blur(10px)",
                  border: "1px solid rgba(255, 255, 255, 0.3)",
                  color: "white",
                  padding: "16px 24px",
                  borderRadius: "16px",
                  cursor: "pointer",
                  fontSize: "16px",
                  fontWeight: "700",
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  transform: isRefreshing ? "scale(0.95)" : "scale(1)",
                }}
                onMouseEnter={(e) => {
                  if (!isRefreshing) {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.3)"
                    e.currentTarget.style.transform = "scale(1.05)"
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)"
                  e.currentTarget.style.transform = isRefreshing ? "scale(0.95)" : "scale(1)"
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    animation: isRefreshing ? "spin 1s linear infinite" : "none",
                    marginRight: "8px",
                  }}
                >
                  🔄
                </span>
                {isRefreshing ? "REFRESHING..." : "REFRESH DATA"}
              </button>
            </div>
          </div>

          <div style={{ padding: "40px" }}>
            {hadirHariIni.length === 0 ? (
              <div style={{ textAlign: "center", padding: "80px 0" }}>
                <div
                  style={{
                    width: "120px",
                    height: "120px",
                    background: "rgba(59, 130, 246, 0.1)",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 32px",
                    fontSize: "60px",
                    animation: "pulse-glow 3s infinite",
                  }}
                >
                  👥
                </div>
                <p
                  style={{
                    color: "rgba(255, 255, 255, 0.9)",
                    fontSize: "24px",
                    margin: "0 0 12px 0",
                    fontWeight: "700",
                    textShadow: "0 2px 10px rgba(0,0,0,0.3)",
                  }}
                >
                  BELUM ADA YANG HADIR HARI INI
                </p>
                <p style={{ color: "rgba(255, 255, 255, 0.7)", margin: 0, fontSize: "16px" }}>
                  Data akan muncul setelah ada yang melakukan presensi
                </p>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
                  gap: "32px",
                }}
              >
                {hadirHariIni.map((person, index) => (
                  <div
                    key={`${person.username}-${index}`}
                    style={{
                      background: "rgba(255, 255, 255, 0.1)",
                      backdropFilter: "blur(20px)",
                      borderRadius: "24px",
                      padding: "32px",
                      border: "1px solid rgba(255, 255, 255, 0.2)",
                      transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                      cursor: "pointer",
                      position: "relative",
                      overflow: "hidden",
                      animation: `slideInUp 0.6s ease-out forwards ${index * 100}ms`,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "scale(1.05) translateY(-8px)"
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)"
                      e.currentTarget.style.boxShadow = "0 20px 40px rgba(0, 0, 0, 0.2)"
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "scale(1) translateY(0)"
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)"
                      e.currentTarget.style.boxShadow = "none"
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        height: "3px",
                        background: "linear-gradient(90deg, #10b981, #059669)",
                      }}
                    />

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: "24px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                        <div style={{ position: "relative" }}>
                          <div
                            style={{
                              width: "72px",
                              height: "72px",
                              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                              borderRadius: "50%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "28px",
                              color: "white",
                              fontWeight: "bold",
                              boxShadow: "0 8px 32px rgba(16, 185, 129, 0.4)",
                              position: "relative",
                            }}
                          >
                            <div
                              style={{
                                position: "absolute",
                                inset: "2px",
                                background: "linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 100%)",
                                borderRadius: "50%",
                              }}
                            />
                            {person.nama.charAt(0)}
                          </div>
                          <div
                            style={{
                              position: "absolute",
                              top: "-6px",
                              right: "-6px",
                              width: "28px",
                              height: "28px",
                              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                              borderRadius: "50%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "16px",
                              color: "white",
                              boxShadow: "0 4px 16px rgba(16, 185, 129, 0.5)",
                              animation: "bounce 2s infinite",
                            }}
                          >
                            ✓
                          </div>
                        </div>
                        <div>
                          <p
                            style={{
                              color: "white",
                              fontSize: "22px",
                              fontWeight: "800",
                              margin: 0,
                              textShadow: "0 2px 10px rgba(0,0,0,0.3)",
                            }}
                          >
                            {person.nama}
                          </p>
                          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "8px" }}>
                            <div
                              style={{
                                width: "12px",
                                height: "12px",
                                background: "#10b981",
                                borderRadius: "50%",
                                animation: "pulse-glow 2s infinite",
                                boxShadow: "0 0 20px rgba(16, 185, 129, 0.6)",
                              }}
                            />
                            <span
                              style={{
                                color: "#10b981",
                                fontSize: "16px",
                                fontWeight: "700",
                                textShadow: "0 2px 10px rgba(0,0,0,0.3)",
                              }}
                            >
                              HADIR
                            </span>
                          </div>
                        </div>
                      </div>
                      <span style={{ fontSize: "32px", animation: "float 3s ease-in-out infinite" }}>✨</span>
                    </div>

                    <div
                      style={{
                        background: "rgba(16, 185, 129, 0.1)",
                        backdropFilter: "blur(10px)",
                        borderRadius: "16px",
                        padding: "20px",
                        border: "1px solid rgba(16, 185, 129, 0.2)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                        <div
                          style={{
                            width: "48px",
                            height: "48px",
                            background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                            borderRadius: "12px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "20px",
                          }}
                        >
                          ⏰
                        </div>
                        <div>
                          <span
                            style={{
                              color: "rgba(255, 255, 255, 0.8)",
                              fontSize: "14px",
                              fontWeight: "600",
                              display: "block",
                              marginBottom: "4px",
                            }}
                          >
                            JAM MASUK
                          </span>
                          <span
                            style={{
                              color: "white",
                              fontWeight: "900",
                              fontSize: "24px",
                              textShadow: "0 2px 10px rgba(0,0,0,0.3)",
                            }}
                          >
                            {person.jam_masuk}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Ultra Modern Rekap Bulanan */}
        <div
          style={{
            background: "rgba(255, 255, 255, 0.1)",
            backdropFilter: "blur(30px)",
            borderRadius: "32px",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            boxShadow: "0 25px 50px rgba(0, 0, 0, 0.1)",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "6px",
              background: "linear-gradient(90deg, #a855f7, #7c3aed, #a855f7)",
              backgroundSize: "200% 100%",
              animation: "gradient-x 3s ease infinite",
            }}
          />

          <div
            style={{
              background: "linear-gradient(135deg, rgba(168, 85, 247, 0.9) 0%, rgba(124, 58, 237, 0.9) 100%)",
              padding: "32px",
              borderBottom: "1px solid rgba(255, 255, 255, 0.2)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "20px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                <div
                  style={{
                    width: "64px",
                    height: "64px",
                    background: "rgba(255, 255, 255, 0.2)",
                    borderRadius: "20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "28px",
                    backdropFilter: "blur(10px)",
                  }}
                >
                  📊
                </div>
                <div>
                  <h2
                    style={{
                      color: "white",
                      fontSize: "32px",
                      fontWeight: "900",
                      margin: 0,
                      textShadow: "0 4px 20px rgba(0,0,0,0.3)",
                    }}
                  >
                    REKAP PRESENSI
                  </h2>
                  <p
                    style={{
                      color: "rgba(255, 255, 255, 0.9)",
                      fontSize: "16px",
                      margin: "8px 0 0 0",
                      fontWeight: "500",
                    }}
                  >
                    Statistik kehadiran bulanan (A-Z)
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
                {!isCurrentMonth && (
                  <button
                    onClick={goToCurrentMonth}
                    style={{
                      background: "rgba(255, 255, 255, 0.2)",
                      backdropFilter: "blur(10px)",
                      border: "1px solid rgba(255, 255, 255, 0.3)",
                      color: "white",
                      padding: "12px 20px",
                      borderRadius: "16px",
                      cursor: "pointer",
                      fontSize: "14px",
                      fontWeight: "700",
                      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.3)"
                      e.currentTarget.style.transform = "scale(1.05)"
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)"
                      e.currentTarget.style.transform = "scale(1)"
                    }}
                  >
                    📅 BULAN INI
                  </button>
                )}

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    background: "rgba(255, 255, 255, 0.1)",
                    backdropFilter: "blur(10px)",
                    borderRadius: "20px",
                    padding: "12px",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                  }}
                >
                  <button
                    onClick={() => navigateBulan("prev")}
                    style={{
                      width: "48px",
                      height: "48px",
                      background: "transparent",
                      border: "none",
                      color: "white",
                      borderRadius: "12px",
                      cursor: "pointer",
                      fontSize: "20px",
                      fontWeight: "bold",
                      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)"
                      e.currentTarget.style.transform = "scale(1.1)"
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent"
                      e.currentTarget.style.transform = "scale(1)"
                    }}
                  >
                    ←
                  </button>

                  <div style={{ textAlign: "center", padding: "0 20px" }}>
                    <p
                      style={{
                        color: "white",
                        fontWeight: "900",
                        fontSize: "20px",
                        margin: 0,
                        textShadow: "0 2px 10px rgba(0,0,0,0.3)",
                      }}
                    >
                      {bulanNama.toUpperCase()}
                    </p>
                    <p style={{ color: "rgba(255, 255, 255, 0.8)", fontSize: "16px", margin: 0, fontWeight: "600" }}>
                      {tahun}
                    </p>
                  </div>

                  <button
                    onClick={() => navigateBulan("next")}
                    style={{
                      width: "48px",
                      height: "48px",
                      background: "transparent",
                      border: "none",
                      color: "white",
                      borderRadius: "12px",
                      cursor: "pointer",
                      fontSize: "20px",
                      fontWeight: "bold",
                      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)"
                      e.currentTarget.style.transform = "scale(1.1)"
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent"
                      e.currentTarget.style.transform = "scale(1)"
                    }}
                  >
                    →
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div style={{ padding: "40px" }}>
            {rekap.length === 0 ? (
              <div style={{ textAlign: "center", padding: "80px 0" }}>
                <div
                  style={{
                    width: "120px",
                    height: "120px",
                    background: "rgba(168, 85, 247, 0.1)",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 32px",
                    fontSize: "60px",
                    animation: "pulse-glow 3s infinite",
                  }}
                >
                  📊
                </div>
                <p
                  style={{
                    color: "rgba(255, 255, 255, 0.9)",
                    fontSize: "24px",
                    margin: "0 0 12px 0",
                    fontWeight: "700",
                    textShadow: "0 2px 10px rgba(0,0,0,0.3)",
                  }}
                >
                  TIDAK ADA DATA UNTUK {bulanNama.toUpperCase()} {tahun}
                </p>
                <p style={{ color: "rgba(255, 255, 255, 0.7)", margin: 0, fontSize: "16px" }}>
                  Pilih bulan lain atau tunggu data presensi
                </p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "900px" }}>
                  <thead>
                    <tr style={{ borderBottom: "3px solid rgba(255, 255, 255, 0.2)" }}>
                      <th
                        style={{
                          textAlign: "left",
                          padding: "24px",
                          color: "white",
                          fontSize: "18px",
                          fontWeight: "900",
                          background: "rgba(168, 85, 247, 0.1)",
                          textShadow: "0 2px 10px rgba(0,0,0,0.3)",
                        }}
                      >
                        👤 NAMA (A-Z)
                      </th>
                      <th
                        style={{
                          textAlign: "center",
                          padding: "24px",
                          color: "white",
                          fontSize: "18px",
                          fontWeight: "900",
                          background: "rgba(16, 185, 129, 0.1)",
                          textShadow: "0 2px 10px rgba(0,0,0,0.3)",
                        }}
                      >
                        ✅ HADIR
                      </th>
                      <th
                        style={{
                          textAlign: "center",
                          padding: "24px",
                          color: "white",
                          fontSize: "18px",
                          fontWeight: "900",
                          background: "rgba(239, 68, 68, 0.1)",
                          textShadow: "0 2px 10px rgba(0,0,0,0.3)",
                        }}
                      >
                        ❌ TIDAK HADIR
                      </th>
                      <th
                        style={{
                          textAlign: "center",
                          padding: "24px",
                          color: "white",
                          fontSize: "18px",
                          fontWeight: "900",
                          background: "rgba(59, 130, 246, 0.1)",
                          textShadow: "0 2px 10px rgba(0,0,0,0.3)",
                        }}
                      >
                        📊 PERSENTASE
                      </th>
                      <th
                        style={{
                          textAlign: "center",
                          padding: "24px",
                          color: "white",
                          fontSize: "18px",
                          fontWeight: "900",
                          background: "rgba(245, 158, 11, 0.1)",
                          textShadow: "0 2px 10px rgba(0,0,0,0.3)",
                        }}
                      >
                        🏆 STATUS
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rekap.map((item, index) => (
                      <tr
                        key={index}
                        style={{
                          borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)"
                          e.currentTarget.style.transform = "scale(1.01)"
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent"
                          e.currentTarget.style.transform = "scale(1)"
                        }}
                      >
                        <td style={{ padding: "24px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                            <div
                              style={{
                                width: "56px",
                                height: "56px",
                                background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
                                borderRadius: "50%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "white",
                                fontWeight: "bold",
                                fontSize: "20px",
                                boxShadow: "0 8px 32px rgba(59, 130, 246, 0.3)",
                                position: "relative",
                              }}
                            >
                              <div
                                style={{
                                  position: "absolute",
                                  inset: "2px",
                                  background: "linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 100%)",
                                  borderRadius: "50%",
                                }}
                              />
                              {item.nama.charAt(0)}
                            </div>
                            <span
                              style={{
                                color: "white",
                                fontSize: "18px",
                                fontWeight: "800",
                                textShadow: "0 2px 10px rgba(0,0,0,0.3)",
                              }}
                            >
                              {item.nama}
                            </span>
                          </div>
                        </td>
                        <td style={{ textAlign: "center", padding: "24px" }}>
                          <div
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "12px",
                              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                              color: "white",
                              border: "2px solid rgba(255, 255, 255, 0.3)",
                              padding: "16px 24px",
                              borderRadius: "20px",
                              fontSize: "20px",
                              fontWeight: "900",
                              minWidth: "100px",
                              justifyContent: "center",
                              boxShadow: "0 8px 32px rgba(16, 185, 129, 0.4)",
                              transition: "all 0.3s ease",
                              textShadow: "0 2px 10px rgba(0,0,0,0.3)",
                            }}
                          >
                            <span style={{ fontSize: "18px" }}>✅</span>
                            <span>{item.jumlahHadir}</span>
                          </div>
                        </td>
                        <td style={{ textAlign: "center", padding: "24px" }}>
                          <div
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "12px",
                              background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                              color: "white",
                              border: "2px solid rgba(255, 255, 255, 0.3)",
                              padding: "16px 24px",
                              borderRadius: "20px",
                              fontSize: "20px",
                              fontWeight: "900",
                              minWidth: "100px",
                              justifyContent: "center",
                              boxShadow: "0 8px 32px rgba(239, 68, 68, 0.4)",
                              transition: "all 0.3s ease",
                              textShadow: "0 2px 10px rgba(0,0,0,0.3)",
                            }}
                          >
                            <span style={{ fontSize: "18px" }}>❌</span>
                            <span>{item.jumlahTidakHadir}</span>
                          </div>
                        </td>
                        <td style={{ textAlign: "center", padding: "24px" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "20px" }}>
                            <div
                              style={{
                                height: "60px",
                                width: "120px",
                                background: `linear-gradient(135deg, ${getPerformanceColor(item.persentaseHadir)}, ${getPerformanceColor(item.persentaseHadir)}dd)`,
                                borderRadius: "20px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "white",
                                fontWeight: "900",
                                fontSize: "22px",
                                boxShadow: `0 8px 32px ${getPerformanceColor(item.persentaseHadir)}33`,
                                position: "relative",
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  position: "absolute",
                                  inset: "2px",
                                  background: "linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 100%)",
                                  borderRadius: "18px",
                                }}
                              />
                              {item.persentaseHadir}%
                            </div>
                            <div
                              style={{
                                width: "140px",
                                height: "20px",
                                background: "rgba(255, 255, 255, 0.2)",
                                borderRadius: "10px",
                                overflow: "hidden",
                                border: "1px solid rgba(255, 255, 255, 0.3)",
                                position: "relative",
                              }}
                            >
                              <div
                                style={{
                                  height: "100%",
                                  background: `linear-gradient(90deg, ${getPerformanceColor(item.persentaseHadir)}, ${getPerformanceColor(item.persentaseHadir)}dd)`,
                                  width: `${item.persentaseHadir}%`,
                                  borderRadius: "10px",
                                  transition: "width 2s cubic-bezier(0.4, 0, 0.2, 1)",
                                  boxShadow: `0 0 20px ${getPerformanceColor(item.persentaseHadir)}66`,
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign: "center", padding: "24px" }}>
                          <div
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "16px",
                              padding: "16px 28px",
                              borderRadius: "20px",
                              background: `linear-gradient(135deg, ${getPerformanceColor(item.persentaseHadir)}, ${getPerformanceColor(item.persentaseHadir)}dd)`,
                              color: "white",
                              fontWeight: "900",
                              fontSize: "18px",
                              boxShadow: `0 8px 32px ${getPerformanceColor(item.persentaseHadir)}33`,
                              minWidth: "160px",
                              justifyContent: "center",
                              position: "relative",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                position: "absolute",
                                inset: "2px",
                                background: "linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 100%)",
                                borderRadius: "18px",
                              }}
                            />
                            <span style={{ fontSize: "24px", position: "relative", zIndex: 1 }}>
                              {item.persentaseHadir >= 90
                                ? "🏆"
                                : item.persentaseHadir >= 80
                                  ? "🎯"
                                  : item.persentaseHadir >= 70
                                    ? "📈"
                                    : "📉"}
                            </span>
                            <span style={{ position: "relative", zIndex: 1 }}>
                              {getPerformanceStatus(item.persentaseHadir)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-20px);
          }
        }
        
        @keyframes pulse-glow {
          0%, 100% {
            opacity: 1;
            box-shadow: 0 0 20px currentColor;
          }
          50% {
            opacity: 0.7;
            box-shadow: 0 0 40px currentColor;
          }
        }
        
        @keyframes gradient-x {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }
        
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        
        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        
        @keyframes bounce {
          0%, 20%, 53%, 80%, 100% {
            transform: translate3d(0,0,0);
          }
          40%, 43% {
            transform: translate3d(0, -8px, 0);
          }
          70% {
            transform: translate3d(0, -4px, 0);
          }
          90% {
            transform: translate3d(0, -2px, 0);
          }
        }
        
        @media (max-width: 768px) {
          table {
            font-size: 14px;
          }
          
          th, td {
            padding: 16px 12px !important;
          }
          
          .stats-card {
            padding: 24px !important;
          }
          
          h1 {
            font-size: 20px !important;
          }
          
          h2 {
            font-size: 24px !important;
          }
        }
        
        @media (max-width: 480px) {
          .stats-card {
            padding: 20px !important;
          }
          
          h1 {
            font-size: 18px !important;
          }
          
          h2 {
            font-size: 20px !important;
          }
          
          th, td {
            padding: 12px 8px !important;
            font-size: 12px !important;
          }
        }
      `}</style>
    </div>
  )
}
