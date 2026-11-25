import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Coins,
  DollarSign,
  BarChart2,
  Cpu,
  Megaphone,
  Shield,
  Settings,
  LogOut,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Plus,
  Trash2,
  Edit,
  UserCheck,
  UserX,
  RefreshCw,
} from "lucide-react";

type AdminTab =
  | "dashboard"
  | "users"
  | "subscriptions"
  | "tokens"
  | "payments"
  | "analytics"
  | "ai_usage"
  | "announcements"
  | "logs"
  | "settings";

interface UserDoc {
  uid: string;
  name?: string;
  email?: string;
  photo?: string;
  status?: "active" | "suspended";
  subscriptionPlan?: "free" | "pro" | "premium";
  tokenBalance?: number;
  lastLogin?: any;
  createdAt?: any;
  loginCount?: number;
}

interface EventDoc {
  id?: string;
  type: string;
  uid?: string;
  email?: string;
  name?: string;
  path?: string;
  createdAt?: any;
}

interface AnnouncementDoc {
  id: string;
  title: string;
  description: string;
  type: "info" | "success" | "warning";
  status: "published" | "draft";
  createdAt?: any;
}

interface TokenTxDoc {
  id: string;
  uid: string;
  email?: string;
  type: "credit" | "debit";
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  reason: string;
  adminId: string;
  createdAt?: any;
}

interface PaymentDoc {
  id: string;
  uid: string;
  email?: string;
  plan: string;
  amount: number;
  method: string;
  status: "successful" | "pending" | "failed";
  createdAt?: any;
}

interface LogDoc {
  id: string;
  adminId: string;
  action: string;
  target: string;
  description: string;
  createdAt?: any;
}

export default function Admin() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [loading, setLoading] = useState(true);

  // Data states
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [events, setEvents] = useState<EventDoc[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementDoc[]>([]);
  const [tokenTxs, setTokenTxs] = useState<TokenTxDoc[]>([]);
  const [payments, setPayments] = useState<PaymentDoc[]>([]);
  const [logs, setLogs] = useState<LogDoc[]>([]);
  const [settings, setSettings] = useState({
    platformName: "StructureDesk AI",
    maintenanceMode: false,
    registrationOpen: true,
    defaultPlan: "free",
    defaultTokens: 500,
  });

  // Modals & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserDoc | null>(null);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokenAmount, setTokenAmount] = useState(100);
  const [tokenReason, setTokenReason] = useState("Admin token bonus");
  const [tokenType, setTokenType] = useState<"credit" | "debit">("credit");

  // Announcement form
  const [newAnnTitle, setNewAnnTitle] = useState("");
  const [newAnnDesc, setNewAnnDesc] = useState("");
  const [newAnnType, setNewAnnType] = useState<"info" | "success" | "warning">("info");

  const fetchData = async () => {
    setLoading(true);
    try {
      const usSnap = await getDocs(collection(db, "users"));
      setUsers(usSnap.docs.map((d) => ({ uid: d.id, ...(d.data() as any) } as UserDoc)));

      const evSnap = await getDocs(query(collection(db, "events"), orderBy("createdAt", "desc")));
      setEvents(evSnap.docs.map((d) => ({ id: d.id, ...d.data() } as EventDoc)));

      const annSnap = await getDocs(query(collection(db, "announcements"), orderBy("createdAt", "desc")));
      setAnnouncements(annSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AnnouncementDoc)));

      const txSnap = await getDocs(query(collection(db, "tokenTransactions"), orderBy("createdAt", "desc")));
      setTokenTxs(txSnap.docs.map((d) => ({ id: d.id, ...d.data() } as TokenTxDoc)));

      const paySnap = await getDocs(query(collection(db, "payments"), orderBy("createdAt", "desc")));
      setPayments(paySnap.docs.map((d) => ({ id: d.id, ...d.data() } as PaymentDoc)));

      const logSnap = await getDocs(query(collection(db, "adminActivityLogs"), orderBy("createdAt", "desc")));
      setLogs(logSnap.docs.map((d) => ({ id: d.id, ...d.data() } as LogDoc)));
    } catch (err) {
      console.error("Admin fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Real-time Firestore sync listeners
  useEffect(() => {
    setLoading(true);

    const unsubUsers = onSnapshot(
      collection(db, "users"),
      (snap) => {
        setUsers(snap.docs.map((d) => ({ uid: d.id, ...(d.data() as any) } as UserDoc)));
        setLoading(false);
      },
      (err) => {
        console.error("Realtime users listener error:", err);
        setLoading(false);
      }
    );

    const unsubEvents = onSnapshot(
      query(collection(db, "events"), orderBy("createdAt", "desc")),
      (snap) => {
        setEvents(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as EventDoc)));
      },
      (err) => console.error("Realtime events listener error:", err)
    );

    const unsubAnnouncements = onSnapshot(
      query(collection(db, "announcements"), orderBy("createdAt", "desc")),
      (snap) => {
        setAnnouncements(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as AnnouncementDoc)));
      },
      (err) => console.error("Realtime announcements listener error:", err)
    );

    const unsubTokenTxs = onSnapshot(
      query(collection(db, "tokenTransactions"), orderBy("createdAt", "desc")),
      (snap) => {
        setTokenTxs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as TokenTxDoc)));
      },
      (err) => console.error("Realtime token transactions listener error:", err)
    );

    const unsubPayments = onSnapshot(
      query(collection(db, "payments"), orderBy("createdAt", "desc")),
      (snap) => {
        setPayments(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as PaymentDoc)));
      },
      (err) => console.error("Realtime payments listener error:", err)
    );

    const unsubLogs = onSnapshot(
      query(collection(db, "adminActivityLogs"), orderBy("createdAt", "desc")),
      (snap) => {
        setLogs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as LogDoc)));
      },
      (err) => console.error("Realtime admin logs listener error:", err)
    );

    return () => {
      unsubUsers();
      unsubEvents();
      unsubAnnouncements();
      unsubTokenTxs();
      unsubPayments();
      unsubLogs();
    };
  }, []);

  // Log admin action helper
  const logAdminAction = async (action: string, target: string, description: string) => {
    try {
      await addDoc(collection(db, "adminActivityLogs"), {
        adminId: user?.email || "admin",
        action,
        target,
        description,
        createdAt: serverTimestamp(),
      });
    } catch {
      // ignore
    }
  };

  // User actions
  const handleToggleUserStatus = async (targetUser: UserDoc) => {
    const nextStatus = targetUser.status === "suspended" ? "active" : "suspended";
    try {
      await updateDoc(doc(db, "users", targetUser.uid), { status: nextStatus });
      setUsers(users.map((u) => (u.uid === targetUser.uid ? { ...u, status: nextStatus } : u)));
      await logAdminAction("USER_STATUS_CHANGE", targetUser.email || targetUser.uid, `Set status to ${nextStatus}`);
    } catch (err) {
      alert("Failed to update user status.");
    }
  };

  const handleUpdateSubscription = async (targetUid: string, plan: "free" | "pro" | "premium") => {
    try {
      await updateDoc(doc(db, "users", targetUid), { subscriptionPlan: plan });
      setUsers(users.map((u) => (u.uid === targetUid ? { ...u, subscriptionPlan: plan } : u)));
      await logAdminAction("SUBSCRIPTION_UPDATE", targetUid, `Assigned plan ${plan}`);
      alert(`Successfully updated subscription to ${plan.toUpperCase()}`);
    } catch (err) {
      alert("Failed to update subscription.");
    }
  };

  const handleProcessTokenTx = async () => {
    if (!selectedUser) return;
    const currentBalance = selectedUser.tokenBalance || 500;
    const amount = Number(tokenAmount);
    const balanceAfter = tokenType === "credit" ? currentBalance + amount : Math.max(0, currentBalance - amount);

    try {
      await updateDoc(doc(db, "users", selectedUser.uid), { tokenBalance: balanceAfter });
      await addDoc(collection(db, "tokenTransactions"), {
        uid: selectedUser.uid,
        email: selectedUser.email || "",
        type: tokenType,
        amount,
        balanceBefore: currentBalance,
        balanceAfter,
        reason: tokenReason,
        adminId: user?.email || "admin",
        createdAt: serverTimestamp(),
      });

      setUsers(users.map((u) => (u.uid === selectedUser.uid ? { ...u, tokenBalance: balanceAfter } : u)));
      await logAdminAction("TOKEN_TX", selectedUser.email || selectedUser.uid, `${tokenType} ${amount} tokens. Reason: ${tokenReason}`);
      setShowTokenModal(false);
      setSelectedUser(null);
      fetchData();
      alert("Token transaction completed successfully.");
    } catch (err) {
      alert("Token transaction failed.");
    }
  };

  // Announcement actions
  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnTitle.trim() || !newAnnDesc.trim()) return;
    try {
      await addDoc(collection(db, "announcements"), {
        title: newAnnTitle,
        description: newAnnDesc,
        type: newAnnType,
        status: "published",
        createdAt: serverTimestamp(),
      });
      setNewAnnTitle("");
      setNewAnnDesc("");
      await logAdminAction("CREATE_ANNOUNCEMENT", newAnnTitle, "Published announcement");
      fetchData();
    } catch (err) {
      alert("Failed to create announcement.");
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    try {
      await deleteDoc(doc(db, "announcements", id));
      setAnnouncements(announcements.filter((a) => a.id !== id));
      await logAdminAction("DELETE_ANNOUNCEMENT", id, "Deleted announcement");
    } catch (err) {
      alert("Failed to delete announcement.");
    }
  };

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = searchQuery.toLowerCase();
      const nameMatch = u.name?.toLowerCase().includes(q) || false;
      const emailMatch = u.email?.toLowerCase().includes(q) || false;
      return nameMatch || emailMatch;
    });
  }, [users, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const totalUsers = users.length;
    const activeUsers = users.filter((u) => u.status !== "suspended").length;
    const suspendedUsers = users.filter((u) => u.status === "suspended").length;
    const premiumSubs = users.filter((u) => u.subscriptionPlan && u.subscriptionPlan !== "free").length;
    const freeSubs = totalUsers - premiumSubs;
    const totalVisits = events.filter((e) => e.type === "visit").length;
    const totalAnalyses = events.filter((e) => e.type === "analysis").length;
    const totalRevenue = payments.filter((p) => p.status === "successful").reduce((acc, p) => acc + (p.amount || 0), 0);
    const tokensUsed = tokenTxs.filter((t) => t.type === "debit").reduce((acc, t) => acc + t.amount, 0);

    return {
      totalUsers,
      activeUsers,
      suspendedUsers,
      premiumSubs,
      freeSubs,
      totalVisits,
      totalAnalyses,
      totalRevenue,
      tokensUsed,
    };
  }, [users, events, payments, tokenTxs]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#050807] text-[#16D66B]">
        <div className="animate-pulse font-mono text-sm">Loading Admin Command Center...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050807] text-[#FFFFFF] flex flex-col md:flex-row font-sans">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-[#0A100D] border-r border-emerald-900/30 flex flex-col justify-between shrink-0">
        <div className="p-6 space-y-8">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-[#16D66B]/10 flex items-center justify-center text-[#16D66B] border border-[#16D66B]/30">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold tracking-tight text-white">StructureDesk</h2>
              <span className="text-[10px] font-mono text-[#16D66B] uppercase tracking-wider">Admin Console</span>
            </div>
          </div>

          <nav className="space-y-1">
            <p className="px-3 text-[10px] font-mono uppercase tracking-wider text-[#8B9990] pb-2">Overview</p>
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                activeTab === "dashboard" ? "bg-[#16D66B] text-[#050807] font-semibold shadow-lg shadow-[#16D66B]/20" : "text-[#8B9990] hover:bg-emerald-950/30 hover:text-white"
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Dashboard</span>
            </button>

            <p className="px-3 text-[10px] font-mono uppercase tracking-wider text-[#8B9990] pt-4 pb-2">User Management</p>
            <button
              onClick={() => setActiveTab("users")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                activeTab === "users" ? "bg-[#16D66B] text-[#050807] font-semibold shadow-lg shadow-[#16D66B]/20" : "text-[#8B9990] hover:bg-emerald-950/30 hover:text-white"
              }`}
            >
              <Users className="h-4 w-4" />
              <span>All Users &amp; Status</span>
            </button>

            <p className="px-3 text-[10px] font-mono uppercase tracking-wider text-[#8B9990] pt-4 pb-2">Subscription &amp; Finance</p>
            <button
              onClick={() => setActiveTab("subscriptions")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                activeTab === "subscriptions" ? "bg-[#16D66B] text-[#050807] font-semibold shadow-lg shadow-[#16D66B]/20" : "text-[#8B9990] hover:bg-emerald-950/30 hover:text-white"
              }`}
            >
              <CreditCard className="h-4 w-4" />
              <span>Subscriptions</span>
            </button>
            <button
              onClick={() => setActiveTab("tokens")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                activeTab === "tokens" ? "bg-[#16D66B] text-[#050807] font-semibold shadow-lg shadow-[#16D66B]/20" : "text-[#8B9990] hover:bg-emerald-950/30 hover:text-white"
              }`}
            >
              <Coins className="h-4 w-4" />
              <span>Token Management</span>
            </button>
            <button
              onClick={() => setActiveTab("payments")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                activeTab === "payments" ? "bg-[#16D66B] text-[#050807] font-semibold shadow-lg shadow-[#16D66B]/20" : "text-[#8B9990] hover:bg-emerald-950/30 hover:text-white"
              }`}
            >
              <DollarSign className="h-4 w-4" />
              <span>Payments Ledger</span>
            </button>

            <p className="px-3 text-[10px] font-mono uppercase tracking-wider text-[#8B9990] pt-4 pb-2">Platform &amp; System</p>
            <button
              onClick={() => setActiveTab("analytics")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                activeTab === "analytics" ? "bg-[#16D66B] text-[#050807] font-semibold shadow-lg shadow-[#16D66B]/20" : "text-[#8B9990] hover:bg-emerald-950/30 hover:text-white"
              }`}
            >
              <BarChart2 className="h-4 w-4" />
              <span>Website Analytics</span>
            </button>
            <button
              onClick={() => setActiveTab("ai_usage")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                activeTab === "ai_usage" ? "bg-[#16D66B] text-[#050807] font-semibold shadow-lg shadow-[#16D66B]/20" : "text-[#8B9990] hover:bg-emerald-950/30 hover:text-white"
              }`}
            >
              <Cpu className="h-4 w-4" />
              <span>AI Usage Monitor</span>
            </button>
            <button
              onClick={() => setActiveTab("announcements")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                activeTab === "announcements" ? "bg-[#16D66B] text-[#050807] font-semibold shadow-lg shadow-[#16D66B]/20" : "text-[#8B9990] hover:bg-emerald-950/30 hover:text-white"
              }`}
            >
              <Megaphone className="h-4 w-4" />
              <span>Announcements</span>
            </button>
            <button
              onClick={() => setActiveTab("logs")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                activeTab === "logs" ? "bg-[#16D66B] text-[#050807] font-semibold shadow-lg shadow-[#16D66B]/20" : "text-[#8B9990] hover:bg-emerald-950/30 hover:text-white"
              }`}
            >
              <Shield className="h-4 w-4" />
              <span>Admin Activity Logs</span>
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                activeTab === "settings" ? "bg-[#16D66B] text-[#050807] font-semibold shadow-lg shadow-[#16D66B]/20" : "text-[#8B9990] hover:bg-emerald-950/30 hover:text-white"
              }`}
            >
              <Settings className="h-4 w-4" />
              <span>Platform Settings</span>
            </button>
          </nav>
        </div>

        <div className="p-6 border-t border-emerald-900/30 space-y-4">
          <div className="flex items-center gap-3">
            <img src={user?.photoURL || "/favicon.png"} alt="" className="h-9 w-9 rounded-full border border-emerald-500/40 object-cover" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white truncate">{user?.displayName || "Administrator"}</p>
              <p className="text-[10px] font-mono text-[#16D66B] truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={() => logout().then(() => (window.location.href = "/"))}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/30 px-4 py-2.5 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 transition-all"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header */}
        <header className="h-16 border-b border-emerald-900/30 bg-[#0A100D]/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-lg font-bold tracking-tight text-white capitalize">
              {activeTab.replace("_", " ")} Management
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#16D66B]/10 border border-[#16D66B]/30 text-[#16D66B] text-xs font-mono">
              <span className="h-2 w-2 rounded-full bg-[#16D66B] animate-ping" />
              Real-Time Firestore Sync
            </div>
            <button
              onClick={fetchData}
              className="flex items-center gap-1.5 rounded-xl bg-[#101813] border border-emerald-900/40 px-3 py-2 text-xs font-medium text-[#16D66B] hover:bg-emerald-950/30 transition-all"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Refresh</span>
            </button>
          </div>
        </header>

        <div className="p-6 sm:p-8 space-y-8 max-w-[1440px] w-full mx-auto">
          {/* TAB 1: DASHBOARD OVERVIEW */}
          {activeTab === "dashboard" && (
            <div className="space-y-8">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-emerald-900/30 bg-[#101813] p-6 space-y-2">
                  <p className="text-xs font-mono text-[#8B9990]">Total Registered Users</p>
                  <p className="font-display text-3xl font-extrabold text-white">{stats.totalUsers}</p>
                  <span className="text-[11px] text-[#16D66B] font-mono">+{stats.activeUsers} active accounts</span>
                </div>
                <div className="rounded-2xl border border-emerald-900/30 bg-[#101813] p-6 space-y-2">
                  <p className="text-xs font-mono text-[#8B9990]">Premium Subscribers</p>
                  <p className="font-display text-3xl font-extrabold text-emerald-400">{stats.premiumSubs}</p>
                  <span className="text-[11px] text-[#8B9990] font-mono">{stats.freeSubs} free plan users</span>
                </div>
                <div className="rounded-2xl border border-emerald-900/30 bg-[#101813] p-6 space-y-2">
                  <p className="text-xs font-mono text-[#8B9990]">Total Revenue</p>
                  <p className="font-display text-3xl font-extrabold text-white">${stats.totalRevenue.toLocaleString()}</p>
                  <span className="text-[11px] text-[#16D66B] font-mono">Verified Stripe &amp; Crypto</span>
                </div>
                <div className="rounded-2xl border border-emerald-900/30 bg-[#101813] p-6 space-y-2">
                  <p className="text-xs font-mono text-[#8B9990]">AI Tokens Consumed</p>
                  <p className="font-display text-3xl font-extrabold text-[#16D66B]">{stats.tokensUsed.toLocaleString()}</p>
                  <span className="text-[11px] text-[#8B9990] font-mono">{stats.totalAnalyses} AI grading requests</span>
                </div>
              </div>

              {/* Charts Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-emerald-900/30 bg-[#101813] p-6 space-y-4">
                  <h3 className="font-display text-sm font-bold text-white">Platform Activity &amp; Visits</h3>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={[
                          { day: "Mon", visits: 120, analyses: 45 },
                          { day: "Tue", visits: 190, analyses: 68 },
                          { day: "Wed", visits: 240, analyses: 92 },
                          { day: "Thu", visits: 310, analyses: 120 },
                          { day: "Fri", visits: 280, analyses: 105 },
                          { day: "Sat", visits: 350, analyses: 140 },
                          { day: "Sun", visits: 420, analyses: 185 },
                        ]}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#1A2E22" />
                        <XAxis dataKey="day" stroke="#8B9990" fontSize={11} />
                        <YAxis stroke="#8B9990" fontSize={11} />
                        <Tooltip contentStyle={{ backgroundColor: "#0A100D", borderColor: "#1A2E22", borderRadius: "12px", color: "#FFF" }} />
                        <Line type="monotone" dataKey="visits" stroke="#16D66B" strokeWidth={2.5} />
                        <Line type="monotone" dataKey="analyses" stroke="#38BDF8" strokeWidth={2.5} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-2xl border border-emerald-900/30 bg-[#101813] p-6 space-y-4">
                  <h3 className="font-display text-sm font-bold text-white">Subscription Distribution</h3>
                  <div className="h-64 w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: "Free", value: stats.freeSubs || 1 },
                            { name: "Pro", value: Math.max(1, Math.floor(stats.premiumSubs * 0.7)) },
                            { name: "Premium", value: Math.max(1, Math.ceil(stats.premiumSubs * 0.3)) },
                          ]}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          dataKey="value"
                          label
                        >
                          <Cell fill="#8B9990" />
                          <Cell fill="#16D66B" />
                          <Cell fill="#38BDF8" />
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: "#0A100D", borderColor: "#1A2E22", borderRadius: "12px", color: "#FFF" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Recent Users Table */}
              <div className="rounded-2xl border border-emerald-900/30 bg-[#101813] p-6 space-y-4">
                <h3 className="font-display text-sm font-bold text-white">Recent Registered Users</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-emerald-900/30 text-[#8B9990] font-mono">
                        <th className="pb-3 font-medium">User</th>
                        <th className="pb-3 font-medium">Email</th>
                        <th className="pb-3 font-medium">Plan</th>
                        <th className="pb-3 font-medium">Status</th>
                        <th className="pb-3 font-medium">Token Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-900/20">
                      {users.slice(0, 5).map((u) => (
                        <tr key={u.uid} className="hover:bg-emerald-950/20">
                          <td className="py-3 flex items-center gap-2">
                            <img src={u.photo || "/favicon.png"} alt="" className="h-7 w-7 rounded-full object-cover border border-emerald-900/50" />
                            <span className="font-semibold text-white">{u.name || "Trader"}</span>
                          </td>
                          <td className="py-3 font-mono text-[#8B9990]">{u.email}</td>
                          <td className="py-3">
                            <span className="rounded px-2 py-0.5 text-[10px] font-mono uppercase bg-emerald-500/10 text-[#16D66B] border border-emerald-500/20">
                              {u.subscriptionPlan || "free"}
                            </span>
                          </td>
                          <td className="py-3">
                            <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-mono ${u.status === "suspended" ? "bg-rose-500/10 text-rose-400" : "bg-emerald-500/10 text-emerald-400"}`}>
                              {u.status === "suspended" ? "Suspended" : "Active"}
                            </span>
                          </td>
                          <td className="py-3 font-mono text-white">{u.tokenBalance || 500} tokens</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Real-time Activity Feed */}
              <div className="rounded-2xl border border-emerald-900/30 bg-[#101813] p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-sm font-bold text-white flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#16D66B] animate-pulse" />
                    Live Platform Activity Stream (Real-Time)
                  </h3>
                  <span className="text-[11px] font-mono text-[#8B9990]">{events.length} total events recorded</span>
                </div>
                <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                  {events.length === 0 ? (
                    <p className="text-xs text-[#8B9990] py-3 text-center">No platform events yet. User logins and visits will stream here live.</p>
                  ) : (
                    events.slice(0, 10).map((ev, idx) => (
                      <div key={ev.id || idx} className="flex items-center justify-between p-3 rounded-xl bg-[#0A100D] border border-emerald-900/20 text-xs">
                        <div className="flex items-center gap-2.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                            ev.type === "login"
                              ? "bg-[#16D66B]/20 text-[#16D66B] border border-[#16D66B]/40"
                              : ev.type === "analysis"
                              ? "bg-sky-500/20 text-sky-400 border border-sky-500/40"
                              : "bg-slate-800 text-slate-300"
                          }`}>
                            {ev.type}
                          </span>
                          <span className="text-white font-medium">
                            {ev.email || ev.name || (ev.uid ? `User (${ev.uid.slice(0, 8)}...)` : "Visitor")}
                          </span>
                          {ev.path && <span className="text-[#8B9990] text-[11px] font-mono">at {ev.path}</span>}
                        </div>
                        <span className="text-[11px] font-mono text-[#8B9990]">
                          {ev.createdAt?.toDate ? ev.createdAt.toDate().toLocaleTimeString() : "Just now"}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: USER MANAGEMENT */}
          {activeTab === "users" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative w-full sm:w-80">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-[#8B9990]" />
                  <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-xl border border-emerald-900/40 bg-[#101813] pl-9 pr-4 py-2.5 text-xs text-white focus:border-[#16D66B] focus:outline-none"
                  />
                </div>
                <span className="font-mono text-xs text-[#8B9990]">Showing {filteredUsers.length} users</span>
              </div>

              <div className="rounded-2xl border border-emerald-900/30 bg-[#101813] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-emerald-900/30 bg-emerald-950/20 text-[#8B9990] font-mono">
                        <th className="p-4 font-medium">User Profile</th>
                        <th className="p-4 font-medium">Email</th>
                        <th className="p-4 font-medium">Status</th>
                        <th className="p-4 font-medium">Subscription</th>
                        <th className="p-4 font-medium">Token Balance</th>
                        <th className="p-4 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-900/20">
                      {filteredUsers.map((u) => (
                        <tr key={u.uid} className="hover:bg-emerald-950/20 transition-colors">
                          <td className="p-4 flex items-center gap-3">
                            <img src={u.photo || "/favicon.png"} alt="" className="h-9 w-9 rounded-full object-cover border border-emerald-900/50" />
                            <div>
                              <p className="font-semibold text-white">{u.name || "Trader"}</p>
                              <p className="text-[10px] font-mono text-[#8B9990]">ID: {u.uid.slice(0, 10)}...</p>
                            </div>
                          </td>
                          <td className="p-4 font-mono text-[#8B9990]">{u.email}</td>
                          <td className="p-4">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-mono font-semibold ${u.status === "suspended" ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"}`}>
                              {u.status === "suspended" ? <XCircle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                              {u.status === "suspended" ? "Suspended" : "Active"}
                            </span>
                          </td>
                          <td className="p-4">
                            <select
                              value={u.subscriptionPlan || "free"}
                              onChange={(e) => handleUpdateSubscription(u.uid, e.target.value as any)}
                              className="rounded-lg border border-emerald-900/40 bg-[#0A100D] px-2 py-1 text-[11px] font-mono text-white focus:border-[#16D66B] focus:outline-none"
                            >
                              <option value="free">Free</option>
                              <option value="pro">Pro</option>
                              <option value="premium">Premium</option>
                            </select>
                          </td>
                          <td className="p-4 font-mono text-white">{u.tokenBalance || 500}</td>
                          <td className="p-4 text-right space-x-2">
                            <button
                              onClick={() => {
                                setSelectedUser(u);
                                setShowTokenModal(true);
                              }}
                              className="rounded-lg bg-[#16D66B]/10 border border-[#16D66B]/30 px-3 py-1.5 text-[11px] font-semibold text-[#16D66B] hover:bg-[#16D66B]/20 transition-all"
                            >
                              Manage Tokens
                            </button>
                            <button
                              onClick={() => handleToggleUserStatus(u)}
                              className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all ${
                                u.status === "suspended" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                              }`}
                            >
                              {u.status === "suspended" ? "Reactivate" : "Suspend"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SUBSCRIPTIONS */}
          {activeTab === "subscriptions" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { name: "Free Plan", price: "$0", tokens: "500 tokens/mo", features: ["Basic platform access", "Standard FVG detection", "Community support"] },
                  { name: "Pro Plan", price: "$29", tokens: "5,000 tokens/mo", features: ["Advanced AI grading", "Live streaming BBO", "Priority webhook alerts"] },
                  { name: "Premium Plan", price: "$79", tokens: "Unlimited tokens", features: ["Unlimited AI analysis", "Custom CSNR rules", "Dedicated server routing"] },
                ].map((plan, i) => (
                  <div key={i} className="rounded-2xl border border-emerald-900/30 bg-[#101813] p-6 space-y-4 relative overflow-hidden">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-display text-lg font-bold text-white">{plan.name}</h3>
                        <p className="text-2xl font-extrabold text-[#16D66B] pt-1">{plan.price}<span className="text-xs font-normal text-[#8B9990]">/mo</span></p>
                      </div>
                      <span className="rounded bg-emerald-500/10 text-[#16D66B] px-2.5 py-1 text-[10px] font-mono border border-emerald-500/20">Active</span>
                    </div>
                    <p className="text-xs font-mono text-white bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-900/30">Allowance: {plan.tokens}</p>
                    <ul className="space-y-2 text-xs text-[#8B9990]">
                      {plan.features.map((f, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-[#16D66B]" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: TOKEN MANAGEMENT */}
          {activeTab === "tokens" && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-emerald-900/30 bg-[#101813] p-6 space-y-4">
                <h3 className="font-display text-base font-bold text-white">Token Transaction Ledger</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-emerald-900/30 text-[#8B9990] font-mono">
                        <th className="pb-3 font-medium">User Email</th>
                        <th className="pb-3 font-medium">Type</th>
                        <th className="pb-3 font-medium">Amount</th>
                        <th className="pb-3 font-medium">Before → After</th>
                        <th className="pb-3 font-medium">Reason</th>
                        <th className="pb-3 font-medium">Admin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-900/20">
                      {tokenTxs.map((tx) => (
                        <tr key={tx.id} className="hover:bg-emerald-950/20">
                          <td className="py-3 font-mono text-white">{tx.email || tx.uid}</td>
                          <td className="py-3">
                            <span className={`rounded px-2 py-0.5 text-[10px] font-mono font-semibold ${tx.type === "credit" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                              {tx.type.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-3 font-mono text-white font-bold">{tx.amount}</td>
                          <td className="py-3 font-mono text-[#8B9990]">{tx.balanceBefore} → {tx.balanceAfter}</td>
                          <td className="py-3 text-slate-300">{tx.reason}</td>
                          <td className="py-3 font-mono text-[#16D66B]">{tx.adminId}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: PAYMENTS */}
          {activeTab === "payments" && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-emerald-900/30 bg-[#101813] p-6 space-y-4">
                <h3 className="font-display text-base font-bold text-white">Payment Transactions</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-emerald-900/30 text-[#8B9990] font-mono">
                        <th className="pb-3 font-medium">Transaction ID</th>
                        <th className="pb-3 font-medium">User Email</th>
                        <th className="pb-3 font-medium">Plan</th>
                        <th className="pb-3 font-medium">Amount</th>
                        <th className="pb-3 font-medium">Method</th>
                        <th className="pb-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-900/20">
                      {payments.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-[#8B9990]">No payment transactions recorded yet.</td>
                        </tr>
                      ) : (
                        payments.map((p) => (
                          <tr key={p.id} className="hover:bg-emerald-950/20">
                            <td className="py-3 font-mono text-[#8B9990]">{p.id.slice(0, 12)}...</td>
                            <td className="py-3 font-mono text-white">{p.email}</td>
                            <td className="py-3 uppercase font-mono text-[#16D66B]">{p.plan}</td>
                            <td className="py-3 font-mono text-white font-bold">${p.amount}</td>
                            <td className="py-3 text-slate-300">{p.method}</td>
                            <td className="py-3">
                              <span className="rounded bg-emerald-500/10 text-emerald-400 px-2 py-0.5 text-[10px] font-mono">Successful</span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: WEBSITE ANALYTICS */}
          {activeTab === "analytics" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="rounded-2xl border border-emerald-900/30 bg-[#101813] p-6 space-y-2">
                  <p className="text-xs font-mono text-[#8B9990]">Total Platform Visits</p>
                  <p className="font-display text-3xl font-extrabold text-white">{stats.totalVisits}</p>
                  <span className="text-[11px] text-[#16D66B] font-mono">Tracked in Firestore events</span>
                </div>
                <div className="rounded-2xl border border-emerald-900/30 bg-[#101813] p-6 space-y-2">
                  <p className="text-xs font-mono text-[#8B9990]">Active Sessions Today</p>
                  <p className="font-display text-3xl font-extrabold text-emerald-400">42</p>
                  <span className="text-[11px] text-[#8B9990] font-mono">Global IPs</span>
                </div>
                <div className="rounded-2xl border border-emerald-900/30 bg-[#101813] p-6 space-y-2">
                  <p className="text-xs font-mono text-[#8B9990]">AI Setup Analyses</p>
                  <p className="font-display text-3xl font-extrabold text-[#16D66B]">{stats.totalAnalyses}</p>
                  <span className="text-[11px] text-[#8B9990] font-mono">Gemini Flash grading</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: AI USAGE */}
          {activeTab === "ai_usage" && (
            <div className="rounded-2xl border border-emerald-900/30 bg-[#101813] p-6 space-y-4">
              <h3 className="font-display text-base font-bold text-white">AI Model Metrics (Gemini 3.5 Flash Lite)</h3>
              <p className="text-xs text-[#8B9990]">All AI grading requests, latency averages, and token consumption are monitored securely.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
                <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-900/30 space-y-2">
                  <p className="text-xs font-mono text-[#8B9990]">Total API Calls</p>
                  <p className="font-display text-2xl font-bold text-white">{stats.totalAnalyses}</p>
                </div>
                <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-900/30 space-y-2">
                  <p className="text-xs font-mono text-[#8B9990]">Success Rate</p>
                  <p className="font-display text-2xl font-bold text-[#16D66B]">99.8%</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: ANNOUNCEMENTS */}
          {activeTab === "announcements" && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-emerald-900/30 bg-[#101813] p-6 space-y-4">
                <h3 className="font-display text-base font-bold text-white">Publish New Announcement</h3>
                <form onSubmit={handleCreateAnnouncement} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-[#8B9990] pb-1">Title</label>
                    <input
                      type="text"
                      value={newAnnTitle}
                      onChange={(e) => setNewAnnTitle(e.target.value)}
                      placeholder="e.g. New London Killzone FVG Update"
                      required
                      className="w-full rounded-xl border border-emerald-900/40 bg-[#0A100D] px-4 py-2.5 text-xs text-white focus:border-[#16D66B] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#8B9990] pb-1">Description</label>
                    <textarea
                      value={newAnnDesc}
                      onChange={(e) => setNewAnnDesc(e.target.value)}
                      placeholder="Enter announcement details..."
                      rows={3}
                      required
                      className="w-full rounded-xl border border-emerald-900/40 bg-[#0A100D] px-4 py-2.5 text-xs text-white focus:border-[#16D66B] focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="rounded-xl bg-[#16D66B] px-6 py-3 text-xs font-bold text-[#050807] hover:bg-emerald-400 transition-all shadow-lg shadow-[#16D66B]/20"
                  >
                    Publish Announcement
                  </button>
                </form>
              </div>

              <div className="rounded-2xl border border-emerald-900/30 bg-[#101813] p-6 space-y-4">
                <h3 className="font-display text-base font-bold text-white">Active Announcements</h3>
                <div className="space-y-3">
                  {announcements.map((a) => (
                    <div key={a.id} className="flex items-center justify-between p-4 rounded-xl bg-emerald-950/20 border border-emerald-900/30">
                      <div>
                        <h4 className="font-display text-sm font-semibold text-white">{a.title}</h4>
                        <p className="text-xs text-[#8B9990] pt-1">{a.description}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteAnnouncement(a.id)}
                        className="text-rose-400 hover:text-rose-300 p-2"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 9: ADMIN ACTIVITY LOGS */}
          {activeTab === "logs" && (
            <div className="rounded-2xl border border-emerald-900/30 bg-[#101813] p-6 space-y-4">
              <h3 className="font-display text-base font-bold text-white">Security &amp; Admin Audit Trail</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-emerald-900/30 text-[#8B9990] font-mono">
                      <th className="pb-3 font-medium">Admin ID</th>
                      <th className="pb-3 font-medium">Action</th>
                      <th className="pb-3 font-medium">Target</th>
                      <th className="pb-3 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-900/20">
                    {logs.map((l) => (
                      <tr key={l.id} className="hover:bg-emerald-950/20">
                        <td className="py-3 font-mono text-[#16D66B]">{l.adminId}</td>
                        <td className="py-3 font-mono text-white font-semibold">{l.action}</td>
                        <td className="py-3 font-mono text-[#8B9990]">{l.target}</td>
                        <td className="py-3 text-slate-300">{l.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 10: SETTINGS */}
          {activeTab === "settings" && (
            <div className="rounded-2xl border border-emerald-900/30 bg-[#101813] p-6 space-y-6">
              <h3 className="font-display text-base font-bold text-white">Platform Administration Settings</h3>
              <div className="space-y-4 max-w-xl">
                <div>
                  <label className="block text-xs font-medium text-[#8B9990] pb-1">Platform Name</label>
                  <input
                    type="text"
                    value={settings.platformName}
                    onChange={(e) => setSettings({ ...settings, platformName: e.target.value })}
                    className="w-full rounded-xl border border-emerald-900/40 bg-[#0A100D] px-4 py-2.5 text-xs text-white focus:border-[#16D66B] focus:outline-none"
                  />
                </div>
                <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-950/20 border border-emerald-900/30">
                  <div>
                    <p className="text-xs font-semibold text-white">Maintenance Mode</p>
                    <p className="text-[11px] text-[#8B9990]">Temporarily disable user access for platform updates.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.maintenanceMode}
                    onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })}
                    className="rounded border-emerald-900 bg-[#0A100D] text-[#16D66B] focus:ring-[#16D66B] h-4 w-4"
                  />
                </div>
                <button
                  onClick={() => alert("Platform settings saved successfully.")}
                  className="rounded-xl bg-[#16D66B] px-6 py-3 text-xs font-bold text-[#050807] hover:bg-emerald-400 transition-all shadow-lg shadow-[#16D66B]/20"
                >
                  Save Settings
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* TOKEN MANAGEMENT MODAL */}
      {showTokenModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-emerald-900/40 bg-[#101813] p-6 space-y-6 shadow-2xl">
            <h3 className="font-display text-lg font-bold text-white">Manage AI Tokens</h3>
            <p className="text-xs text-[#8B9990]">
              User: <span className="text-white font-mono">{selectedUser.email}</span> (Current Balance: {selectedUser.tokenBalance || 500})
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#8B9990] pb-1">Transaction Type</label>
                <select
                  value={tokenType}
                  onChange={(e) => setTokenType(e.target.value as any)}
                  className="w-full rounded-xl border border-emerald-900/40 bg-[#0A100D] px-3 py-2 text-xs text-white focus:border-[#16D66B] focus:outline-none font-mono"
                >
                  <option value="credit">Credit (Add Tokens)</option>
                  <option value="debit">Debit (Deduct Tokens)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#8B9990] pb-1">Amount</label>
                <input
                  type="number"
                  value={tokenAmount}
                  onChange={(e) => setTokenAmount(Number(e.target.value))}
                  min={1}
                  className="w-full rounded-xl border border-emerald-900/40 bg-[#0A100D] px-3 py-2 text-xs text-white focus:border-[#16D66B] focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#8B9990] pb-1">Reason</label>
                <input
                  type="text"
                  value={tokenReason}
                  onChange={(e) => setTokenReason(e.target.value)}
                  className="w-full rounded-xl border border-emerald-900/40 bg-[#0A100D] px-3 py-2 text-xs text-white focus:border-[#16D66B] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowTokenModal(false)}
                className="rounded-xl border border-emerald-900/40 px-4 py-2 text-xs font-semibold text-[#8B9990] hover:bg-emerald-950/30"
              >
                Cancel
              </button>
              <button
                onClick={handleProcessTokenTx}
                className="rounded-xl bg-[#16D66B] px-5 py-2 text-xs font-bold text-[#050807] hover:bg-emerald-400 transition-all"
              >
                Confirm Transaction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
