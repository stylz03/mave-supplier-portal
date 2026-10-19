/* ============================================================
   MUREZA / MAVE Supplier Portal — CMS Logic & Administration Controller
   Manages real-time data sync, tier creation, pricing adjustments,
   supplier document review, and applicant tier assignment.
   ============================================================ */

import {
  onSiteContentSnapshot,
  saveSiteContent,
  onTiersSnapshot,
  saveTier,
  deleteTier,
  seedDefaultTiers,
  onSubmissionsSnapshot,
  updateSubmission,
  submitSupplierRegistration,
  onNotificationsSnapshot,
  markNotificationRead,
  setFirebaseApiKey,
  getIsConnected,
  loginAdmin,
  logoutAdmin,
  getCurrentAdminUser,
  onAdminAuthChanged,
  sendSupplierEmail,
  DEFAULT_PAGE_CONTENT,
  DEFAULT_TIERS,
  DEFAULT_TENDERS,
  onTendersSnapshot,
  onBidsSnapshot,
  seedDefaultTenders,
  saveTender,
  deleteTender,
  updateBidStatus,
  createAdminSupplierEntry
} from "./firebase-client.js";

// --- State Cache ---
let state = {
  content: { ...DEFAULT_PAGE_CONTENT },
  tiers: [...DEFAULT_TIERS],
  submissions: [],
  notifications: [],
  tenders: [...DEFAULT_TENDERS],
  bids: [],
  activeFilter: "all",
  activeTenderFilter: "all",
  activeSubmission: null,
  activeTierEdit: null,
  activeInspectingTender: null,
  currentAdmin: null
};

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
  setupAuthGate();
  setupSidebarCollapse();
  setupTabs();
  setupMobileBottomNav();
  setupPwaInstallPrompt();
  setupFilterButtons();
  setupSearch();
  setupModals();
  setupContentForm();
  setupTierForm();
  setupPaymentAndEmailSettings();
  setupNotificationCenter();
  setupPwaNotificationsUI();
  setupSeedDemo();
  setupTendersTab();
  setupTenderModals();

  function updateBackendBadge() {
    const badge = document.getElementById("backendBadge");
    if (!badge) return;
    if (getIsConnected()) {
      badge.className = "cms-badge badge-backend";
      badge.textContent = "mave-invest-prod";
      badge.style.background = "";
      badge.style.color = "";
      badge.style.border = "";
    } else {
      badge.className = "cms-badge";
      badge.style.background = "rgba(224, 159, 62, 0.15)";
      badge.style.color = "#fbbf24";
      badge.style.border = "1px solid rgba(251, 191, 36, 0.3)";
      badge.textContent = "Local Storage (Offline/Demo)";
    }
  }
  updateBackendBadge();
  setInterval(updateBackendBadge, 3000);

  // 1. Subscribe to Page Content
  onSiteContentSnapshot((content) => {
    state.content = content;
    populateContentForm(content);
  });

  // 2. Subscribe to Tiers
  onTiersSnapshot((tiers) => {
    state.tiers = tiers;
    renderTiersGrid();
    updateCapacityMetrics();
    populateTierAssignmentOptions();
  });

  // 3. Subscribe to Supplier Submissions
  onSubmissionsSnapshot((submissions) => {
    const prevCount = state.submissions.length;
    state.submissions = submissions;
    renderSubmissions();
    updateOverviewMetrics();

    // If new submission arrived while viewing
    if (prevCount > 0 && submissions.length > prevCount) {
      const latest = submissions[0];
      const company = latest?.companyName || "A new supplier";
      const code = latest?.trackingCode || "MVR-2026";
      showToast(`New supplier application received: ${company}`);
      triggerPwaNotification("New Supplier Application", {
        body: `${company} submitted an onboarding dossier (${code}).`,
        tag: `submission-${latest?.id || Date.now()}`
      });
    }
  });

  // 4. Subscribe to Notifications
  onNotificationsSnapshot((notifications) => {
    state.notifications = notifications;
    renderNotifications();
    const unread = notifications.filter((n) => !n.read).length;
    if ("setAppBadge" in navigator) {
      if (unread > 0) {
        navigator.setAppBadge(unread).catch(() => {});
      } else {
        navigator.clearAppBadge().catch(() => {});
      }
    }
  });

  // 5. Subscribe to Tenders
  onTendersSnapshot((tenders) => {
    state.tenders = tenders;
    renderTendersTab();
    updateTendersMetrics();
  });

  // 6. Subscribe to Tender Bids
  onBidsSnapshot((bids) => {
    const prevBidsCount = state.bids.length;
    state.bids = bids;
    renderTendersTab();
    updateTendersMetrics();
    if (state.activeInspectingTender) {
      const refreshed = state.tenders.find((t) => t.id === state.activeInspectingTender.id) || state.activeInspectingTender;
      renderTenderBidsModal(refreshed);
    }

    if (prevBidsCount > 0 && bids.length > prevBidsCount) {
      const latestBid = bids[0];
      const company = latestBid?.companyName || "Supplier";
      const ref = latestBid?.bidRef || "BID";
      showToast(`New tender bid received: ${company} (${ref})`);
      triggerPwaNotification("New Tender Bid Received", {
        body: `${company} submitted a quotation (${ref}) on the OEM platform.`,
        tag: `bid-${latestBid?.id || Date.now()}`
      });
    }
  });
});

// ============================================================
// UI NAVIGATION, COLLAPSIBLE SIDEBAR & RESPONSIVE TABS
// ============================================================

function setupSidebarCollapse() {
  const toggleBtn = document.getElementById("sidebarCollapseBtn");
  const sidebar = document.getElementById("cmsSidebar");
  if (!sidebar) return;

  const applyCollapsedState = (collapsed) => {
    if (collapsed) {
      sidebar.classList.add("collapsed");
      document.body.classList.add("sidebar-collapsed");
    } else {
      sidebar.classList.remove("collapsed");
      document.body.classList.remove("sidebar-collapsed");
    }
  };

  // Restore saved state from localStorage
  const savedState = localStorage.getItem("cms_sidebar_collapsed") === "true";
  applyCollapsedState(savedState);

  const toggle = () => {
    const isNowCollapsed = !sidebar.classList.contains("collapsed");
    applyCollapsedState(isNowCollapsed);
    try {
      localStorage.setItem("cms_sidebar_collapsed", isNowCollapsed ? "true" : "false");
    } catch (e) {
      console.warn("Could not save sidebar preference to localStorage:", e);
    }
  };

  if (toggleBtn) {
    toggleBtn.addEventListener("click", toggle);
  }

  // Keyboard shortcut: Ctrl+B or Cmd+B
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === "b" || e.key === "B")) {
      e.preventDefault();
      toggle();
    }
  });
}

function switchTab(tabId) {
  if (!tabId) return;

  // Update desktop sidebar items
  document.querySelectorAll(".cms-nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.tab === tabId);
  });

  // Update bottom nav items
  document.querySelectorAll(".bottom-nav-item[data-tab]").forEach((item) => {
    item.classList.toggle("active", item.dataset.tab === tabId);
  });

  // Switch tab content container
  document.querySelectorAll(".cms-tab-content").forEach((c) => {
    c.classList.remove("active");
  });
  const activeContent = document.getElementById(tabId);
  if (activeContent) {
    activeContent.classList.add("active");
  }

  // Close mobile more sheet if open
  closeMobileMoreSheet();

  // Scroll to top cleanly
  const main = document.querySelector(".cms-main");
  if (main) main.scrollTop = 0;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setupTabs() {
  const desktopTabs = document.querySelectorAll(".cms-nav-item");
  desktopTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const targetId = tab.dataset.tab;
      if (targetId) switchTab(targetId);
    });
  });
}

function closeMobileMoreSheet() {
  const sheet = document.getElementById("mobileMoreSheet");
  const backdrop = document.getElementById("mobileMoreBackdrop");
  if (sheet) sheet.classList.remove("active");
  if (backdrop) backdrop.classList.remove("active");
}

function openMobileMoreSheet() {
  const sheet = document.getElementById("mobileMoreSheet");
  const backdrop = document.getElementById("mobileMoreBackdrop");
  if (sheet) sheet.classList.add("active");
  if (backdrop) backdrop.classList.add("active");
}

function setupMobileBottomNav() {
  // Bottom navigation tab triggers
  document.querySelectorAll(".bottom-nav-item[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.tab;
      if (targetId) switchTab(targetId);
    });
  });

  // "More" button toggles bottom drawer
  const moreBtn = document.getElementById("bottomNavMoreBtn");
  if (moreBtn) {
    moreBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openMobileMoreSheet();
    });
  }

  // Close buttons and backdrop click
  const closeBtn = document.getElementById("mobileMoreCloseBtn");
  const backdrop = document.getElementById("mobileMoreBackdrop");
  if (closeBtn) closeBtn.addEventListener("click", closeMobileMoreSheet);
  if (backdrop) backdrop.addEventListener("click", closeMobileMoreSheet);

  // Sheet nav items
  document.querySelectorAll(".mobile-more-item[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.tab;
      if (targetId) switchTab(targetId);
    });
  });

  // Sheet Seed Test Application trigger
  const sheetSeedBtn = document.getElementById("sheetSeedBtn");
  if (sheetSeedBtn) {
    sheetSeedBtn.addEventListener("click", () => {
      closeMobileMoreSheet();
      const desktopSeedBtn = document.getElementById("seedDemoBtn");
      if (desktopSeedBtn) desktopSeedBtn.click();
    });
  }

  // Sheet Sign Out trigger
  const sheetSignOutBtn = document.getElementById("sheetSignOutBtn");
  if (sheetSignOutBtn) {
    sheetSignOutBtn.addEventListener("click", () => {
      closeMobileMoreSheet();
      const signOutBtn = document.getElementById("adminSignOutBtn");
      if (signOutBtn) signOutBtn.click();
    });
  }
}

let deferredPwaPrompt = null;
function setupPwaInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPwaPrompt = e;
    const pwaBtn = document.getElementById("pwaInstallAdminBtn");
    if (pwaBtn) {
      pwaBtn.style.display = "flex";
      pwaBtn.addEventListener("click", async () => {
        if (!deferredPwaPrompt) return;
        deferredPwaPrompt.prompt();
        const { outcome } = await deferredPwaPrompt.userChoice;
        if (outcome === "accepted") {
          showToast("MAVE Admin installed successfully!");
        }
        deferredPwaPrompt = null;
        pwaBtn.style.display = "none";
        closeMobileMoreSheet();
      });
    }
  });

  window.addEventListener("appinstalled", () => {
    deferredPwaPrompt = null;
    const pwaBtn = document.getElementById("pwaInstallAdminBtn");
    if (pwaBtn) pwaBtn.style.display = "none";
    showToast("App is ready on your Home Screen.");
  });
}

// ============================================================
// NOTIFICATION CENTER
// ============================================================

function setupNotificationCenter() {
  const bell = document.getElementById("notifBellBtn");
  const dropdown = document.getElementById("notifDropdown");
  const clearBtn = document.getElementById("markAllReadBtn");

  bell.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.classList.toggle("open");
  });

  document.addEventListener("click", (e) => {
    if (!dropdown.contains(e.target) && e.target !== bell) {
      dropdown.classList.remove("open");
    }
  });

  clearBtn.addEventListener("click", () => {
    state.notifications.forEach((n) => {
      if (!n.read) markNotificationRead(n.id);
    });
    dropdown.classList.remove("open");
    if ("clearAppBadge" in navigator) {
      navigator.clearAppBadge().catch(() => {});
    }
  });
}

function renderNotifications() {
  const unreadCount = state.notifications.filter((n) => !n.read).length;
  const pill = document.getElementById("notifCountPill");
  if (pill) {
    pill.textContent = unreadCount;
    pill.style.display = unreadCount > 0 ? "inline-block" : "none";
  }

  const dropdownList = document.getElementById("notifList");
  const fullList = document.getElementById("fullNotifList");

  if (state.notifications.length === 0) {
    const emptyHtml = `<div style="padding: 24px; text-align: center; color: var(--ink-faint); font-size: 13px;">No notifications yet.</div>`;
    if (dropdownList) dropdownList.innerHTML = emptyHtml;
    if (fullList) fullList.innerHTML = emptyHtml;
    return;
  }

  const html = state.notifications
    .slice(0, 15)
    .map(
      (n) => `
      <div class="notif-item ${n.read ? "" : "unread"}" onclick="window.handleNotificationClick('${n.id}', '${n.submissionId}')">
        <div class="notif-item-title">${escapeHtml(n.title)}</div>
        <div class="notif-item-msg">${escapeHtml(n.message)}</div>
        <div class="notif-item-time">${formatDate(n.createdAt)}</div>
      </div>
    `
    )
    .join("");

  if (dropdownList) dropdownList.innerHTML = html;
  if (fullList) fullList.innerHTML = html;
}

window.handleNotificationClick = (notifId, submissionId) => {
  markNotificationRead(notifId);
  const dropdown = document.getElementById("notifDropdown");
  if (dropdown) dropdown.classList.remove("open");

  if (submissionId) {
    const sub = state.submissions.find((s) => s.id === submissionId);
    if (sub) {
      window.openDossierModal(sub);
      return;
    }
  }
  document.querySelector('[data-tab="tab-submissions"]').click();
};

// ============================================================
// PWA PUSH & DEVICE SYSTEM NOTIFICATIONS
// ============================================================

export async function triggerPwaNotification(title, options = {}) {
  if (!("Notification" in window)) return false;
  if (Notification.permission !== "granted") return false;

  const notifOptions = {
    body: options.body || "New procurement update in MAVE Supplier Portal.",
    icon: "/assets/brand/mave_icon_192.png",
    badge: "/assets/brand/favicon-mave.jpg",
    vibrate: [120, 60, 120],
    data: { url: "/admin" },
    tag: options.tag || `mave-alert-${Date.now()}`,
    renotify: true,
    ...options
  };

  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(title, notifOptions);
        return true;
      }
    }
  } catch (err) {
    console.warn("[PWA Notification] SW showNotification failed, falling back to Notification API:", err);
  }

  try {
    new Notification(title, notifOptions);
    return true;
  } catch (err) {
    console.warn("[PWA Notification] Direct Notification failed:", err);
    return false;
  }
}

function setupPwaNotificationsUI() {
  const statusDot = document.getElementById("pwaNotifStatusDot");
  const statusBadge = document.getElementById("pwaNotifStatusBadge");
  const toggleBtn = document.getElementById("togglePwaNotifBtn");
  const testBtn = document.getElementById("testPwaNotifBtn");
  const sheetBtn = document.getElementById("sheetPwaNotifBtn");
  const sheetText = document.getElementById("sheetPwaNotifText");

  function refreshStatus() {
    if (!("Notification" in window)) {
      if (statusDot) statusDot.style.background = "#6b7280";
      if (statusBadge) {
        statusBadge.textContent = "NOT SUPPORTED";
        statusBadge.style.background = "rgba(107, 114, 128, 0.2)";
        statusBadge.style.color = "#9ca3af";
      }
      if (toggleBtn) {
        toggleBtn.textContent = "Unsupported Device";
        toggleBtn.disabled = true;
      }
      if (testBtn) testBtn.disabled = true;
      if (sheetText) sheetText.textContent = "Device Alerts: Unsupported";
      return;
    }

    const perm = Notification.permission;
    if (perm === "granted") {
      if (statusDot) statusDot.style.background = "#4ade80";
      if (statusBadge) {
        statusBadge.textContent = "ACTIVE (OS PERMITTED)";
        statusBadge.style.background = "rgba(74, 222, 128, 0.15)";
        statusBadge.style.color = "#4ade80";
      }
      if (toggleBtn) {
        toggleBtn.textContent = "Notifications Active";
        toggleBtn.className = "cms-btn cms-btn-outline";
        toggleBtn.style.color = "#4ade80";
        toggleBtn.style.borderColor = "rgba(74, 222, 128, 0.4)";
      }
      if (testBtn) testBtn.disabled = false;
      if (sheetText) sheetText.textContent = "Device Alerts: Active";
    } else if (perm === "denied") {
      if (statusDot) statusDot.style.background = "#ef4444";
      if (statusBadge) {
        statusBadge.textContent = "BLOCKED IN BROWSER";
        statusBadge.style.background = "rgba(239, 68, 68, 0.15)";
        statusBadge.style.color = "#f87171";
      }
      if (toggleBtn) {
        toggleBtn.textContent = "Permission Blocked";
        toggleBtn.className = "cms-btn cms-btn-outline";
        toggleBtn.style.color = "#f87171";
        toggleBtn.style.borderColor = "rgba(239, 68, 68, 0.4)";
      }
      if (testBtn) testBtn.disabled = false;
      if (sheetText) sheetText.textContent = "Device Alerts: Blocked";
    } else {
      if (statusDot) statusDot.style.background = "#f59e0b";
      if (statusBadge) {
        statusBadge.textContent = "PERMISSION REQUIRED";
        statusBadge.style.background = "rgba(245, 158, 11, 0.15)";
        statusBadge.style.color = "#fbbf24";
      }
      if (toggleBtn) {
        toggleBtn.textContent = "Enable Device Notifications";
        toggleBtn.className = "cms-btn cms-btn-gold";
        toggleBtn.style.color = "";
        toggleBtn.style.borderColor = "";
      }
      if (testBtn) testBtn.disabled = false;
      if (sheetText) sheetText.textContent = "Enable Device Notifications";
    }
  }

  refreshStatus();

  async function handleRequestPermission() {
    if (!("Notification" in window)) {
      showToast("System notifications are not supported on this browser.");
      return;
    }

    if (Notification.permission === "granted") {
      showToast("Device notifications are already active.");
      return;
    }

    if (Notification.permission === "denied") {
      showToast("Notifications blocked. Please allow notifications in site settings.");
      return;
    }

    try {
      const res = await Notification.requestPermission();
      refreshStatus();
      if (res === "granted") {
        showToast("Device notifications enabled successfully.");
        triggerPwaNotification("MAVE Procurement Alert", {
          body: "System notifications are active. You will receive real-time alerts for supplier applications and bids.",
          tag: "mave-welcome"
        });
      } else {
        showToast("Notification permission was not granted.");
      }
    } catch (err) {
      showToast("Error requesting notification permission: " + err.message);
    }
  }

  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      if (Notification.permission === "granted") {
        showToast("Device notifications are already active for this device.");
      } else if (Notification.permission === "denied") {
        showToast("Notifications blocked in browser. Enable notifications in your browser site settings.");
      } else {
        handleRequestPermission();
      }
    });
  }

  if (sheetBtn) {
    sheetBtn.addEventListener("click", () => {
      closeMobileMoreSheet();
      handleRequestPermission();
    });
  }

  if (testBtn) {
    testBtn.addEventListener("click", async () => {
      if (!("Notification" in window)) {
        showToast("Notifications not supported on this browser.");
        return;
      }

      if (Notification.permission !== "granted") {
        const res = await Notification.requestPermission();
        refreshStatus();
        if (res !== "granted") {
          showToast("Please allow notification permissions to test device alerts.");
          return;
        }
      }

      const sent = await triggerPwaNotification("MAVE Test Procurement Alert", {
        body: "PWA device notification is functioning properly. Alerts are wired for live applications.",
        tag: `test-alert-${Date.now()}`
      });

      if (sent) {
        showToast("Test notification dispatched to your device.");
      } else {
        showToast("Failed to dispatch test notification.");
      }
    });
  }
}

// ============================================================
// METRICS & OVERVIEW
// ============================================================

function updateOverviewMetrics() {
  const total = state.submissions.length;
  const pending = state.submissions.filter((s) => s.status === "pending").length;
  const approved = state.submissions.filter((s) => s.status === "approved").length;

  document.getElementById("statTotalApps").textContent = total;
  document.getElementById("statPendingApps").textContent = pending;
  document.getElementById("statApprovedApps").textContent = approved;

  const pendingBadge = document.getElementById("pendingBadge");
  if (pendingBadge) {
    pendingBadge.textContent = pending;
    pendingBadge.style.display = pending > 0 ? "inline-block" : "none";
  }

  const bottomPendingBadge = document.getElementById("bottomPendingBadge");
  if (bottomPendingBadge) {
    bottomPendingBadge.textContent = pending;
    bottomPendingBadge.style.display = pending > 0 ? "inline-block" : "none";
  }

  // Update filter counters
  document.getElementById("countFilterAll").textContent = total;
  document.getElementById("countFilterPending").textContent = pending;
  document.getElementById("countFilterReview").textContent = state.submissions.filter((s) => s.status === "under_review").length;
  document.getElementById("countFilterTier").textContent = state.submissions.filter((s) => s.status === "tier_assigned").length;
  document.getElementById("countFilterApproved").textContent = approved;
  document.getElementById("countFilterDeclined").textContent = state.submissions.filter((s) => s.status === "declined").length;

  renderOverviewRecentTable();
}

function updateCapacityMetrics() {
  const totalCapacity = state.tiers.reduce((acc, t) => acc + (Number(t.capacity) || 0), 0);
  const filledSlots = state.tiers.reduce((acc, t) => acc + (Number(t.filled) || 0), 0);
  const el = document.getElementById("statCapacityFilled");
  if (el) el.textContent = `${filledSlots} / ${totalCapacity || 50}`;
}

function renderOverviewRecentTable() {
  const tbody = document.getElementById("overviewRecentTable");
  if (!tbody) return;

  const recent = state.submissions.slice(0, 5);
  if (recent.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--ink-faint); padding: 30px;">No applications recorded yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = recent
    .map(
      (s) => `
    <tr>
      <td>
        <div class="company-cell">
          <span class="company-name">${escapeHtml(s.companyName)}</span>
          <span class="company-meta">${escapeHtml(s.trackingCode || s.id)}</span>
        </div>
      </td>
      <td>${escapeHtml(s.country || "—")}</td>
      <td><span style="color: var(--ink-faint); font-weight: 500;">${getTierLabel(s.selectedTier)}</span></td>
      <td><span style="color: var(--gold); font-weight: 600;">${getTierLabel(s.assignedTier)}</span></td>
      <td><span class="status-pill status-${s.status || "pending"}">${formatStatus(s.status)}</span></td>
      <td>${s.documents ? s.documents.length : 0} files</td>
      <td>${formatDate(s.submittedAt)}</td>
      <td>
        <button class="cms-btn cms-btn-outline" style="padding: 4px 10px; font-size: 11px;" onclick="window.openDossierById('${s.id}')">
          Review &amp; Assign
        </button>
      </td>
    </tr>
  `
    )
    .join("");
}

// ============================================================
// SUPPLIER APPLICATION PIPELINE & REVIEW (CORE USER REQUIREMENT)
// ============================================================

function setupFilterButtons() {
  const buttons = document.querySelectorAll(".sub-filter-btn");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => {
        b.classList.remove("cms-btn-gold");
        b.classList.add("cms-btn-outline");
      });
      btn.classList.remove("cms-btn-outline");
      btn.classList.add("cms-btn-gold");

      state.activeFilter = btn.dataset.filter;
      renderSubmissions();
    });
  });
}

function setupSearch() {
  const input = document.getElementById("submissionSearchInput");
  if (input) {
    input.addEventListener("input", () => {
      renderSubmissions();
    });
  }
}

function renderSubmissions() {
  const tbody = document.getElementById("allSubmissionsTable");
  if (!tbody) return;

  const search = (document.getElementById("submissionSearchInput")?.value || "").toLowerCase().trim();

  let filtered = state.submissions;
  if (state.activeFilter !== "all") {
    filtered = filtered.filter((s) => s.status === state.activeFilter);
  }

  if (search) {
    filtered = filtered.filter(
      (s) =>
        (s.companyName || "").toLowerCase().includes(search) ||
        (s.trackingCode || "").toLowerCase().includes(search) ||
        (s.country || "").toLowerCase().includes(search) ||
        (s.contactName || "").toLowerCase().includes(search) ||
        (s.contactEmail || "").toLowerCase().includes(search)
    );
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--ink-faint); padding: 40px;">No applications found matching the selected criteria.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered
    .map(
      (s) => `
    <tr>
      <td><span style="font-family: monospace; color: var(--gold); font-weight: 600;">${escapeHtml(s.trackingCode || "—")}</span></td>
      <td>
        <div class="company-cell">
          <span class="company-name">${escapeHtml(s.companyName)}</span>
          <span class="company-meta">${escapeHtml(s.primaryCategory || "Manufacturing")}</span>
        </div>
      </td>
      <td>
        <div>${escapeHtml(s.contactName || "—")}</div>
        <div style="font-size: 11px; color: var(--ink-faint);">${escapeHtml(s.contactEmail || "")}</div>
      </td>
      <td>${escapeHtml(s.country || "—")}</td>
      <td><span style="color: var(--ink-faint); font-weight: 500;">${getTierLabel(s.selectedTier)}</span></td>
      <td><span style="color: var(--gold); font-weight: 700;">${getTierLabel(s.assignedTier)}</span></td>
      <td><span class="status-pill status-${s.status || "pending"}">${formatStatus(s.status)}</span></td>
      <td>
        <span style="font-size: 12px; font-weight: 600;">${s.documents ? s.documents.length : 0} Docs</span>
      </td>
      <td>
        <button class="cms-btn cms-btn-outline" style="padding: 6px 12px; font-size: 11px;" onclick="window.openDossierById('${s.id}')">
          Inspect &amp; Assign Tier →
        </button>
      </td>
    </tr>
  `
    )
    .join("");
}

// ============================================================
// DOSSIER EVALUATION & TIER ASSIGNMENT MODAL
// ============================================================

window.openDossierById = (id) => {
  const sub = state.submissions.find((s) => s.id === id);
  if (sub) window.openDossierModal(sub);
};

window.openDossierModal = (sub) => {
  state.activeSubmission = sub;

  document.getElementById("dossierTrackingCode").textContent = sub.trackingCode || sub.id;
  document.getElementById("dossierCompanyName").textContent = sub.companyName;
  document.getElementById("dossierRegNo").textContent = sub.registrationNumber || "Not specified";
  document.getElementById("dossierCountry").textContent = sub.country || "—";
  document.getElementById("dossierContact").textContent = `${sub.contactName || "—"} (${sub.contactRole || "Contact"})`;
  const emailEsc = escapeHtml(sub.contactEmail || "");
  const phoneEsc = escapeHtml(sub.contactPhone || "");
  document.getElementById("dossierContactDetails").innerHTML = `
    ${emailEsc ? `<a href="mailto:${emailEsc}" style="color: var(--gold); text-decoration: underline;">${emailEsc}</a>` : ""} 
    ${phoneEsc ? `<span style="color: var(--ink-faint);">| ${phoneEsc}</span>` : ""}
  `;
  document.getElementById("dossierCategory").textContent = sub.primaryCategory || "Automotive Component Fabrication";
  document.getElementById("dossierSelectedTier").textContent = getTierLabel(sub.selectedTier);
  document.getElementById("dossierCapability").textContent = sub.capabilitySummary || "No detailed capability statement submitted.";

  // Render submitted documents
  const docsList = document.getElementById("dossierDocsList");
  const countEl = document.getElementById("dossierDocCount");
  const docs = sub.documents || [];
  countEl.textContent = `${docs.length} File${docs.length === 1 ? "" : "s"}`;

  if (docs.length === 0) {
    docsList.innerHTML = `<div style="color: var(--ink-faint); font-size: 12px; padding: 12px; background: rgba(10,7,5,0.3); border-radius: 4px;">No documents uploaded with this submission.</div>`;
  } else {
    docsList.innerHTML = docs
      .map(
        (doc, i) => {
          const isData = (doc.url || "").startsWith("data:");
          const downloadAttr = isData
            ? `download="${escapeHtml(doc.name || `Document_${i + 1}.pdf`)}"`
            : `target="_blank" rel="noopener noreferrer"`;

          return `
      <div class="doc-item">
        <div class="doc-info">
          <span class="doc-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          </span>
          <div>
            <div class="doc-name">${escapeHtml(doc.name || `Document_${i + 1}.pdf`)}</div>
            <div class="doc-meta">${formatFileSize(doc.size)} • ${formatDate(doc.uploadedAt)}</div>
          </div>
        </div>
        <div style="display: flex; gap: 8px;">
          <a href="${doc.url || "#"}" ${downloadAttr} class="cms-btn cms-btn-outline" style="padding: 6px 12px; font-size: 11px;">
            View / Download ↗
          </a>
        </div>
      </div>
    `;
        }
      )
      .join("");
  }

  // Populate Tier selection dropdown
  populateTierAssignmentOptions(sub.assignedTier || sub.selectedTier);

  // Set current status and notes
  document.getElementById("dossierStatusSelect").value = sub.status || "pending";
  document.getElementById("dossierNotesInput").value = sub.reviewerNotes || "";

  document.getElementById("dossierModal").classList.add("open");
};

window.closeDossierModal = () => {
  document.getElementById("dossierModal").classList.remove("open");
  state.activeSubmission = null;
};

function populateTierAssignmentOptions(selectedTierId) {
  const select = document.getElementById("dossierAssignTierSelect");
  if (!select) return;

  select.innerHTML = state.tiers
    .map(
      (t) => `
    <option value="${t.id}" ${t.id === selectedTierId ? "selected" : ""}>
      ${escapeHtml(t.title)} (${escapeHtml(t.sub)}) — Fee: ${escapeHtml(t.feeFormatted || "R " + t.feeAmount)}
    </option>
  `
    )
    .join("");
}

function setupModals() {
  // Save Evaluation & Assign Tier button
  const saveEvalBtn = document.getElementById("saveDossierEvaluationBtn");
  if (saveEvalBtn) {
    saveEvalBtn.addEventListener("click", async () => {
      if (!state.activeSubmission) return;

      const assignedTier = document.getElementById("dossierAssignTierSelect").value;
      const status = document.getElementById("dossierStatusSelect").value;
      const notes = document.getElementById("dossierNotesInput").value;

      saveEvalBtn.textContent = "Saving...";
      saveEvalBtn.disabled = true;

      try {
        await updateSubmission(state.activeSubmission.id, {
          assignedTier,
          status,
          reviewerNotes: notes
        });

        showToast(`Evaluation saved: ${state.activeSubmission.companyName} assigned to ${getTierLabel(assignedTier)}.`);
        closeDossierModal();
      } catch (err) {
        showToast("Error updating application: " + err.message);
      } finally {
        saveEvalBtn.textContent = "Save Evaluation & Assign Tier";
        saveEvalBtn.disabled = false;
      }
    });
  }

  // Generate Provisional Allocation Letter (PDF) button
  const pdfBtn = document.getElementById("generatePdfLetterBtn");
  if (pdfBtn) {
    pdfBtn.addEventListener("click", () => {
      if (!state.activeSubmission) return;
      generateProvisionalAllocationPdf(state.activeSubmission);
    });
  }

  // Backdrop dismiss
  const dossierModal = document.getElementById("dossierModal");
  if (dossierModal) {
    dossierModal.addEventListener("click", (e) => {
      if (e.target === dossierModal) closeDossierModal();
    });
  }

  const tierModal = document.getElementById("tierEditModal");
  if (tierModal) {
    tierModal.addEventListener("click", (e) => {
      if (e.target === tierModal) window.closeTierEditModal();
    });
  }

  // Setup manual supplier intake modal events
  setupCreateSupplierModalEvents();
}

// ============================================================
// MANUAL SUPPLIER INTAKE (ADMIN DIRECT ONBOARDING)
// ============================================================

let createSupplierFiles = [];

export function openCreateSupplierModal() {
  const modal = document.getElementById("createSupplierModal");
  if (!modal) return;

  // Populate tier choices from current state.tiers
  const tierSelect = document.getElementById("newSupSelectedTier");
  if (tierSelect) {
    tierSelect.innerHTML = state.tiers
      .map(
        (t) => `
      <option value="${t.id}">
        ${escapeHtml(t.title)} (${escapeHtml(t.sub)}) — Fee: ${escapeHtml(t.feeFormatted || "R " + t.feeAmount)}
      </option>
    `
      )
      .join("");
  }

  // Clear previous files
  createSupplierFiles = [];
  renderCreateSupplierFileList();

  // Reset form
  const form = document.getElementById("createSupplierForm");
  if (form) form.reset();

  // Reset file input
  const fileInput = document.getElementById("newSupFileInput");
  if (fileInput) fileInput.value = "";

  // Reset submit button text/state
  const submitBtn = document.getElementById("newSupSubmitBtn");
  if (submitBtn) {
    submitBtn.textContent = "Create Supplier & Save Dossier \u2192";
    submitBtn.disabled = false;
  }

  modal.classList.add("open");
}

export function closeCreateSupplierModal() {
  const modal = document.getElementById("createSupplierModal");
  if (modal) modal.classList.remove("open");
  createSupplierFiles = [];
}

window.openCreateSupplierModal = openCreateSupplierModal;
window.closeCreateSupplierModal = closeCreateSupplierModal;

function renderCreateSupplierFileList() {
  const listEl = document.getElementById("newSupFilesList");
  if (!listEl) return;

  if (createSupplierFiles.length === 0) {
    listEl.innerHTML = "";
    return;
  }

  listEl.innerHTML = createSupplierFiles
    .map((file, idx) => {
      const sizeKb = Math.round(file.size / 1024);
      const sizeStr = sizeKb > 1024 ? (sizeKb / 1024).toFixed(1) + " MB" : sizeKb + " KB";
      return `
      <div class="file-pill">
        <div class="file-pill-info">
          <span style="font-size: 14px;">📄</span>
          <span style="font-weight: 600; max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${escapeHtml(file.name)}
          </span>
          <span style="color: var(--ink-faint); font-size: 11px;">(${sizeStr})</span>
        </div>
        <button type="button" class="file-pill-remove" onclick="window.removeNewSupplierFile(${idx})" title="Remove file">&times;</button>
      </div>
    `;
    })
    .join("");
}

window.removeNewSupplierFile = (index) => {
  if (index >= 0 && index < createSupplierFiles.length) {
    createSupplierFiles.splice(index, 1);
    renderCreateSupplierFileList();
  }
};

function setupCreateSupplierModalEvents() {
  const dropzone = document.getElementById("newSupDropzone");
  const fileInput = document.getElementById("newSupFileInput");
  const form = document.getElementById("createSupplierForm");
  const modal = document.getElementById("createSupplierModal");

  if (dropzone && fileInput) {
    dropzone.addEventListener("click", () => fileInput.click());

    fileInput.addEventListener("change", (e) => {
      if (e.target.files) {
        for (const file of Array.from(e.target.files)) {
          if (!createSupplierFiles.some((f) => f.name === file.name && f.size === file.size)) {
            createSupplierFiles.push(file);
          }
        }
        renderCreateSupplierFileList();
      }
    });

    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.classList.add("dragover");
    });

    dropzone.addEventListener("dragleave", () => {
      dropzone.classList.remove("dragover");
    });

    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.classList.remove("dragover");
      if (e.dataTransfer?.files) {
        for (const file of Array.from(e.dataTransfer.files)) {
          if (!createSupplierFiles.some((f) => f.name === file.name && f.size === file.size)) {
            createSupplierFiles.push(file);
          }
        }
        renderCreateSupplierFileList();
      }
    });
  }

  // Backdrop dismiss
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeCreateSupplierModal();
    });
  }

  // Form submission
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const companyName = document.getElementById("newSupCompanyName")?.value.trim();
      const contactName = document.getElementById("newSupContactName")?.value.trim();
      const contactEmail = document.getElementById("newSupContactEmail")?.value.trim();

      if (!companyName || !contactName || !contactEmail) {
        showToast("Please fill in all required fields (*).");
        return;
      }

      const submitBtn = document.getElementById("newSupSubmitBtn");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Uploading Documents & Creating...";
      }

      const currentAdmin = getCurrentAdminUser();

      const formData = {
        companyName,
        registrationNumber: document.getElementById("newSupRegNo")?.value.trim() || "N/A",
        country: document.getElementById("newSupCountry")?.value || "South Africa",
        facilityLocation: document.getElementById("newSupLocation")?.value.trim() || "",
        website: document.getElementById("newSupWebsite")?.value.trim() || "",
        yearEstablished: document.getElementById("newSupYear")?.value || new Date().getFullYear(),
        employeeCount: document.getElementById("newSupEmployees")?.value || "11-50",
        contactName,
        contactRole: document.getElementById("newSupContactRole")?.value.trim() || "Representative",
        contactEmail,
        contactPhone: document.getElementById("newSupContactPhone")?.value.trim() || "",
        primaryCategory: document.getElementById("newSupCategory")?.value || "General Automotive Components",
        selectedTier: document.getElementById("newSupSelectedTier")?.value || "tier-1",
        assignedTier: document.getElementById("newSupSelectedTier")?.value || "tier-1",
        status: document.getElementById("newSupStatus")?.value || "tier_assigned",
        capabilitySummary: document.getElementById("newSupCapability")?.value.trim() || "",
        reviewerNotes: document.getElementById("newSupNotes")?.value.trim() || "Created directly via Admin Backend Intake",
        sendEmail: document.getElementById("newSupSendEmail")?.checked ?? true,
        adminEmail: currentAdmin?.email || "MAVE Procurement Lead"
      };

      try {
        const created = await createAdminSupplierEntry(formData, createSupplierFiles);
        showToast(`Supplier record created: ${created.companyName} (${created.trackingCode})`);
        closeCreateSupplierModal();

        // Switch to Submissions tab if on another tab
        const subTabBtn = document.querySelector('[data-tab="tab-submissions"]');
        if (subTabBtn && !subTabBtn.classList.contains("active")) {
          subTabBtn.click();
        }
      } catch (err) {
        console.error("Manual supplier creation error:", err);
        showToast("Error creating supplier record: " + err.message);
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Create Supplier & Save Dossier \u2192";
        }
      }
    });
  }
}

// ============================================================
// TIERS & PRICING MANAGEMENT (CORE USER REQUIREMENT)
// ============================================================

function renderTiersGrid() {
  const grid = document.getElementById("tiersAdminGrid");
  if (!grid) return;

  grid.innerHTML = state.tiers
    .map((tier) => {
      const pct = Math.min(100, Math.round(((Number(tier.filled) || 0) / (Number(tier.capacity) || 1)) * 100));
      const focusList = Array.isArray(tier.focus) ? tier.focus : (tier.focus || "").split("\n").filter(Boolean);

      return `
      <div class="tier-admin-card" style="border-top: 3px solid ${tier.color || "var(--gold)"};">
        <div class="tier-card-header">
          <div>
            <div class="tier-card-title">${escapeHtml(tier.title)}</div>
            <div class="tier-card-sub" style="color: ${tier.color || "var(--gold)"};">${escapeHtml(tier.sub)}</div>
          </div>
          <div style="display: flex; gap: 6px;">
            <button class="cms-btn cms-btn-outline" style="padding: 4px 8px; font-size: 11px;" onclick="window.editTier('${tier.id}')">Edit</button>
            <button class="cms-btn cms-btn-danger" style="padding: 4px 8px; font-size: 11px;" onclick="window.deleteTierById('${tier.id}')" title="Delete Tier">Delete</button>
          </div>
        </div>

        <!-- Capacity indicator -->
        <div class="tier-capacity-bar">
          <div class="tier-capacity-labels">
            <span>Capacity Allocation</span>
            <span style="font-weight: 600; color: var(--ink);">${tier.filled || 0} / ${tier.capacity || 10} Slots (${pct}%)</span>
          </div>
          <div class="tier-progress-track">
            <div class="tier-progress-fill" style="width: ${pct}%; background: ${tier.color || "var(--gold)"};"></div>
          </div>
        </div>

        <!-- Pricing box -->
        <div class="tier-fee-box">
          <div>
            <div class="tier-fee-term">${escapeHtml(tier.feeFrequency || "Once-off Qualification Fee")}</div>
            <div class="tier-fee-amount">${escapeHtml(tier.feeFormatted || formatCurrency(tier.feeAmount, tier.feeCurrency))}</div>
          </div>
          <span class="status-pill status-approved" style="font-size: 10px;">PRICING ACTIVE</span>
        </div>

        <!-- Deliverables -->
        <div style="font-size: 12px; color: var(--ink-dim); flex: 1;">
          <div style="font-size: 10px; letter-spacing: 0.1em; color: var(--ink-faint); text-transform: uppercase; margin-bottom: 6px;">
            Target Deliverables &amp; Focus
          </div>
          <ul style="padding-left: 16px; line-height: 1.6;">
            ${focusList.slice(0, 4).map((f) => `<li>${escapeHtml(f)}</li>`).join("")}
          </ul>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(207,143,69,0.15); padding-top: 12px; font-size: 11px; color: var(--ink-faint);">
          <span>Code: ${escapeHtml(tier.code || tier.id)}</span>
          <button class="cms-btn cms-btn-outline" style="padding: 4px 8px; font-size: 10px;" onclick="window.editTier('${tier.id}')">
            Adjust Pricing / Slots
          </button>
        </div>
      </div>
    `;
    })
    .join("");
}

function setupTierForm() {
  const addBtn = document.getElementById("addNewTierBtn");
  const saveBtn = document.getElementById("saveTierBtn");

  if (addBtn) {
    addBtn.addEventListener("click", () => {
      window.openTierModal();
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      const id = document.getElementById("editTierId").value || `tier_${Date.now()}`;
      const code = document.getElementById("tierEditCode").value.trim() || "TIER";
      const sub = document.getElementById("tierEditSub").value.trim() || "GENERAL";
      const capacity = Number(document.getElementById("tierEditCapacity").value) || 10;
      const filled = Number(document.getElementById("tierEditFilled").value) || 0;
      const feeAmount = Number(document.getElementById("tierEditFeeAmount").value) || 0;
      const feeCurrency = document.getElementById("tierEditCurrency").value || "ZAR";
      const feeFrequency = document.getElementById("tierEditFeeFrequency").value.trim() || "Once-off Qualification Fee";
      const color = document.getElementById("tierEditColor").value || "#cf8f45";
      const focusText = document.getElementById("tierEditFocus").value;
      const requirements = document.getElementById("tierEditRequirements").value;

      const focus = focusText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      const feeFormatted = formatCurrency(feeAmount, feeCurrency);

      const tierData = {
        id,
        code,
        title: code,
        sub,
        capacity,
        filled,
        feeAmount,
        feeCurrency,
        feeFormatted,
        feeFrequency,
        color,
        focus,
        requirements,
        status: "Active"
      };

      saveBtn.textContent = "Saving...";
      saveBtn.disabled = true;

      try {
        await saveTier(tierData);
        showToast(`Tier ${code} saved successfully.`);
        closeTierModal();
      } catch (err) {
        showToast("Error saving tier: " + err.message);
      } finally {
        saveBtn.textContent = "Save Tier";
        saveBtn.disabled = false;
      }
    });
  }
}

window.openTierModal = (tier = null) => {
  const modal = document.getElementById("tierEditModal");
  const title = document.getElementById("tierModalTitle");

  if (tier) {
    title.textContent = `Edit Tier: ${tier.title}`;
    document.getElementById("editTierId").value = tier.id;
    document.getElementById("tierEditCode").value = tier.code || tier.title;
    document.getElementById("tierEditSub").value = tier.sub || "";
    document.getElementById("tierEditCapacity").value = tier.capacity || 10;
    document.getElementById("tierEditFilled").value = tier.filled || 0;
    document.getElementById("tierEditFeeAmount").value = tier.feeAmount || 30000;
    document.getElementById("tierEditCurrency").value = tier.feeCurrency || "ZAR";
    document.getElementById("tierEditFeeFrequency").value = tier.feeFrequency || "Once-off Qualification Fee";
    document.getElementById("tierEditColor").value = tier.color || "#cf8f45";
    document.getElementById("tierEditFocus").value = Array.isArray(tier.focus) ? tier.focus.join("\n") : tier.focus || "";
    document.getElementById("tierEditRequirements").value = tier.requirements || "";
  } else {
    title.textContent = "Create New Tier";
    document.getElementById("editTierId").value = "";
    document.getElementById("tierEditCode").value = `TIER ${state.tiers.length + 1}`;
    document.getElementById("tierEditSub").value = "SYSTEMS & SUB-ASSEMBLY";
    document.getElementById("tierEditCapacity").value = 10;
    document.getElementById("tierEditFilled").value = 0;
    document.getElementById("tierEditFeeAmount").value = 25000;
    document.getElementById("tierEditCurrency").value = "ZAR";
    document.getElementById("tierEditFeeFrequency").value = "Once-off Qualification Fee";
    document.getElementById("tierEditColor").value = "#cf8f45";
    document.getElementById("tierEditFocus").value = "Specialized manufacturing\nQuality testing\nProduction scaling";
    document.getElementById("tierEditRequirements").value = "Quality management ISO certification";
  }

  modal.classList.add("open");
};

window.closeTierModal = () => {
  document.getElementById("tierEditModal").classList.remove("open");
};

window.editTier = (id) => {
  const t = state.tiers.find((tier) => tier.id === id);
  if (t) window.openTierModal(t);
};

window.deleteTierById = async (id) => {
  const t = state.tiers.find((tier) => tier.id === id);
  if (!t) return;
  if (!confirm(`Are you sure you want to delete ${t.title}? This will also remove it from the live portal.`)) return;

  try {
    await deleteTier(id);
    showToast(`Deleted ${t.title}`);
  } catch (err) {
    showToast("Error deleting tier: " + err.message);
  }
};

// ============================================================
// PAGE CONTENT CMS
// ============================================================

function populateContentForm(content) {
  document.getElementById("fieldDisplayWord").value = content.displayWord || "SUPPLIERS";
  document.getElementById("fieldKicker").value = content.kicker || "01 / STRATEGIC PARTNERS";
  document.getElementById("fieldHeadline").value = content.headline || "BUILDING THE FUTURE.";
  document.getElementById("fieldBrandName").value = content.brandName || "SUPPLIER PORTAL";
  document.getElementById("fieldTagline").value = content.tagline || "";
  document.getElementById("fieldOverviewKicker").value = content.overviewKicker || "";
  document.getElementById("fieldOverviewHeadline").value = content.overviewHeadline || "";
  document.getElementById("fieldOverviewBody").value = content.overviewBody || "";
  document.getElementById("fieldContactEmail").value = content.contactEmail || "suppliers@mave.africa";
  document.getElementById("fieldContactPhone").value = content.contactPhone || "";

  renderPillarsForm(content.pillars || DEFAULT_PAGE_CONTENT.pillars);
}

function renderPillarsForm(pillars) {
  const container = document.getElementById("pillarsEditGrid");
  if (!container) return;

  container.innerHTML = pillars
    .map(
      (p, i) => `
    <div style="background: rgba(14,10,7,0.4); border: 1px solid var(--border); padding: 16px; border-radius: var(--radius-sm);">
      <div style="font-size: 11px; color: var(--gold); font-weight: 600; margin-bottom: 8px;">PILLAR ${p.code || "0" + (i + 1)}</div>
      <div class="form-group">
        <label class="form-label">Title</label>
        <input type="text" class="form-input pillar-title" data-index="${i}" value="${escapeHtml(p.title)}">
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea class="form-textarea pillar-desc" data-index="${i}" style="min-height: 70px;">${escapeHtml(p.desc)}</textarea>
      </div>
    </div>
  `
    )
    .join("");
}

function setupContentForm() {
  const saveBtn = document.getElementById("saveContentBtn");
  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      saveBtn.textContent = "Publishing to Firestore...";
      saveBtn.disabled = true;

      const pillars = [];
      document.querySelectorAll(".pillar-title").forEach((input, i) => {
        const descInput = document.querySelector(`.pillar-desc[data-index="${i}"]`);
        pillars.push({
          code: String(i + 1).padStart(2, "0"),
          title: input.value.trim(),
          desc: descInput ? descInput.value.trim() : ""
        });
      });

      const updated = {
        ...state.content,
        displayWord: document.getElementById("fieldDisplayWord").value.trim(),
        kicker: document.getElementById("fieldKicker").value.trim(),
        headline: document.getElementById("fieldHeadline").value.trim(),
        brandName: document.getElementById("fieldBrandName").value.trim(),
        tagline: document.getElementById("fieldTagline").value.trim(),
        overviewKicker: document.getElementById("fieldOverviewKicker").value.trim(),
        overviewHeadline: document.getElementById("fieldOverviewHeadline").value.trim(),
        overviewBody: document.getElementById("fieldOverviewBody").value.trim(),
        pillars,
        contactEmail: document.getElementById("fieldContactEmail").value.trim(),
        contactPhone: document.getElementById("fieldContactPhone").value.trim(),
        lastUpdated: new Date().toISOString()
      };

      try {
        await saveSiteContent(updated);
        showToast("Portal content published live to Firestore & Portal.");
      } catch (err) {
        showToast("Error saving content: " + err.message);
      } finally {
        saveBtn.textContent = "Publish All Content Changes";
        saveBtn.disabled = false;
      }
    });
  }

  // Reset defaults
  const resetBtn = document.getElementById("resetDefaultsBtn");
  if (resetBtn) {
    resetBtn.addEventListener("click", async () => {
      if (confirm("Reset portal content and tiers to factory defaults?")) {
        await saveSiteContent(DEFAULT_PAGE_CONTENT);
        await seedDefaultTiers();
        showToast("Reset to factory defaults complete.");
      }
    });
  }

  // Export JSON
  const exportBtn = document.getElementById("exportDataBtn");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      const dump = {
        exportedAt: new Date().toISOString(),
        content: state.content,
        tiers: state.tiers,
        submissions: state.submissions
      };
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mureza_supplier_portal_backup_${Date.now()}.json`;
      a.click();
    });
  }

  // Save Firebase API Key locally
  const saveKeyBtn = document.getElementById("saveApiKeyBtn");
  const keyInput = document.getElementById("cfgApiKeyInput");
  if (keyInput) {
    const existing = localStorage.getItem("mureza_firebase_api_key");
    if (existing) keyInput.value = existing;
  }
  if (saveKeyBtn && keyInput) {
    saveKeyBtn.addEventListener("click", () => {
      const val = keyInput.value.trim();
      if (!val) {
        showToast("Please enter an API key");
        return;
      }
      setFirebaseApiKey(val);
      showToast("Firebase API Key saved to local session.");
    });
  }
}

// ============================================================
// CMS AUTHENTICATION GATE (FIREBASE AUTH)
// ============================================================

function setupAuthGate() {
  const overlay = document.getElementById("cmsAuthOverlay");
  const loginForm = document.getElementById("cmsLoginForm");
  const emailInput = document.getElementById("authEmailInput");
  const passwordInput = document.getElementById("authPasswordInput");
  const errorMsg = document.getElementById("authErrorMsg");
  const submitBtn = document.getElementById("authSubmitBtn");
  const bypassBtn = document.getElementById("authBypassBtn");
  const adminEmailText = document.getElementById("adminEmailText");
  const adminSignOutBtn = document.getElementById("adminSignOutBtn");

  const AUTHORIZED_ADMIN_EMAILS = [
    "tinashe@playmotech.co.za",
    "tatenda@mave.africa",
    "admin@mave.africa"
  ];

  function isAuthorizedAdmin(email) {
    if (!email) return false;
    const lower = email.toLowerCase().trim();
    return (
      AUTHORIZED_ADMIN_EMAILS.includes(lower) ||
      lower.endsWith("@mave.africa") ||
      lower.endsWith("@playmotech.co.za")
    );
  }

  function setAuthenticatedUser(user) {
    state.currentAdmin = user;
    if (overlay) overlay.style.display = "none";
    if (adminEmailText && user) {
      adminEmailText.textContent = user.email || "admin@mave.africa";
    }
    try {
      localStorage.setItem("mureza_cms_admin_session", JSON.stringify(user));
    } catch (e) {}
  }

  function setUnauthenticated() {
    const cached = localStorage.getItem("mureza_cms_admin_session");
    if (cached) {
      try {
        const u = JSON.parse(cached);
        if (isAuthorizedAdmin(u.email)) {
          state.currentAdmin = u;
          if (overlay) overlay.style.display = "none";
          if (adminEmailText) adminEmailText.textContent = u.email || "admin@mave.africa";
          return;
        }
      } catch (e) {}
    }
    state.currentAdmin = null;
    if (overlay) overlay.style.display = "flex";
    if (adminEmailText) adminEmailText.textContent = "Unauthenticated";
  }

  // Subscribe to auth state changes
  onAdminAuthChanged((user) => {
    if (user && isAuthorizedAdmin(user.email)) {
      setAuthenticatedUser(user);
    } else {
      setUnauthenticated();
    }
  });

  // Handle Login submission
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = emailInput.value.trim();
      const password = passwordInput.value;

      if (!email || !password) return;

      if (!isAuthorizedAdmin(email)) {
        if (errorMsg) {
          errorMsg.textContent = "Access denied: " + email + " is not an authorized MAVE procurement administrator.";
          errorMsg.style.display = "block";
        }
        return;
      }

      if (errorMsg) errorMsg.style.display = "none";
      submitBtn.textContent = "Authenticating...";
      submitBtn.disabled = true;

      try {
        const user = await loginAdmin(email, password);
        setAuthenticatedUser(user);
        showToast(`Welcome, ${user.email} (Authenticated).`);
      } catch (err) {
        if (errorMsg) {
          errorMsg.textContent = err.message || "Authentication failed. Check credentials.";
          errorMsg.style.display = "block";
        }
      } finally {
        submitBtn.textContent = "Authenticate with Firebase \u2192";
        submitBtn.disabled = false;
      }
    });
  }

  // Dev bypass button
  if (bypassBtn) {
    bypassBtn.addEventListener("click", () => {
      const devUser = { email: "tatenda@mave.africa", displayName: "MAVE Admin (Dev Mode)" };
      localStorage.setItem("mureza_cms_admin_session", JSON.stringify(devUser));
      setAuthenticatedUser(devUser);
      showToast("Dev preview bypass active: Signed in as tatenda@mave.africa");
    });
  }

  // Sign out button
  if (adminSignOutBtn) {
    adminSignOutBtn.addEventListener("click", async () => {
      try {
        localStorage.removeItem("mureza_cms_admin_session");
      } catch (e) {}
      await logoutAdmin();
      setUnauthenticated();
      showToast("Signed out of CMS.");
    });
  }
}

// ============================================================
// QUALIFICATION FEES & EMAIL SETTINGS CONTROLLER
// ============================================================

function setupPaymentAndEmailSettings() {
  const feeToggle = document.getElementById("cfgTierFeesToggle");
  const badge = document.getElementById("tierFeesStatusBadge");
  const stripeKeyInput = document.getElementById("cfgStripePubKey");
  const stripeCurrencySelect = document.getElementById("cfgStripeCurrency");
  const feeWaivedInput = document.getElementById("cfgFeeWaivedLabel");
  const savePaymentBtn = document.getElementById("savePaymentSettingsBtn");

  const resendKeyInput = document.getElementById("cfgResendApiKey");
  const resendSenderInput = document.getElementById("cfgResendSender");
  const saveEmailBtn = document.getElementById("saveEmailSettingsBtn");
  const testEmailBtn = document.getElementById("testEmailBtn");

  function updateFeeBadge(enabled) {
    if (!badge) return;
    if (enabled) {
      badge.textContent = "FEES ACTIVE (STRIPE)";
      badge.style.background = "rgba(207, 143, 69, 0.2)";
      badge.style.color = "var(--gold)";
      badge.style.borderColor = "rgba(207, 143, 69, 0.4)";
    } else {
      badge.textContent = "PILOT MODE (FEES WAIVED)";
      badge.style.background = "rgba(104, 211, 145, 0.15)";
      badge.style.color = "#68d391";
      badge.style.borderColor = "rgba(104, 211, 145, 0.3)";
    }
  }

  function populateFields(content) {
    if (feeToggle) feeToggle.checked = content.tierFeesEnabled === true;
    updateFeeBadge(content.tierFeesEnabled === true);

    if (stripeKeyInput) stripeKeyInput.value = content.stripeConfig?.publishableKey || "";
    if (stripeCurrencySelect) stripeCurrencySelect.value = content.stripeConfig?.currency || "ZAR";
    if (feeWaivedInput) feeWaivedInput.value = content.feeWaivedLabel || "Fee Waived — AfCFTA Pilot Onboarding";

    if (resendKeyInput) resendKeyInput.value = content.resendConfig?.apiKey || "";
    if (resendSenderInput) resendSenderInput.value = content.resendConfig?.fromEmail || "MAVE <onboarding@mave.africa>";
  }

  populateFields(state.content);

  onSiteContentSnapshot((content) => {
    populateFields(content);
  });

  if (feeToggle) {
    feeToggle.addEventListener("change", () => {
      updateFeeBadge(feeToggle.checked);
    });
  }

  if (savePaymentBtn) {
    savePaymentBtn.addEventListener("click", async () => {
      savePaymentBtn.textContent = "Saving...";
      savePaymentBtn.disabled = true;

      const tierFeesEnabled = feeToggle ? feeToggle.checked : false;
      const stripeConfig = {
        enabled: tierFeesEnabled,
        publishableKey: stripeKeyInput ? stripeKeyInput.value.trim() : "",
        currency: stripeCurrencySelect ? stripeCurrencySelect.value : "ZAR",
        testMode: true
      };
      const feeWaivedLabel = feeWaivedInput ? feeWaivedInput.value.trim() : "Fee Waived — AfCFTA Pilot Onboarding";

      try {
        await saveSiteContent({
          ...state.content,
          tierFeesEnabled,
          stripeConfig,
          feeWaivedLabel
        });
        showToast(`Payment settings saved. Mode: ${tierFeesEnabled ? "Stripe Checkout Active" : "AfCFTA Pilot (Fees Waived)"}`);
      } catch (e) {
        showToast("Error saving payment settings: " + e.message);
      } finally {
        savePaymentBtn.textContent = "Save Payment Settings";
        savePaymentBtn.disabled = false;
      }
    });
  }

  if (saveEmailBtn) {
    saveEmailBtn.addEventListener("click", async () => {
      saveEmailBtn.textContent = "Saving...";
      saveEmailBtn.disabled = true;

      const resendConfig = {
        enabled: true,
        apiKey: resendKeyInput ? resendKeyInput.value.trim() : "",
        fromEmail: resendSenderInput ? resendSenderInput.value.trim() : "MAVE <onboarding@mave.africa>",
        replyTo: "suppliers@mave.africa"
      };

      try {
        await saveSiteContent({
          ...state.content,
          resendConfig
        });
        showToast("Resend email settings updated.");
      } catch (e) {
        showToast("Error saving email settings: " + e.message);
      } finally {
        saveEmailBtn.textContent = "Save Email Settings";
        saveEmailBtn.disabled = false;
      }
    });
  }

  if (testEmailBtn) {
    testEmailBtn.addEventListener("click", async () => {
      const target = state.currentAdmin?.email || "tatenda@mave.africa";
      testEmailBtn.textContent = "Sending Test...";
      testEmailBtn.disabled = true;

      try {
        const result = await sendSupplierEmail({
          type: "registration_received",
          to: target,
          companyName: "Test Manufacturing Partner (Pty) Ltd",
          contactName: "Tatenda Chengeta",
          trackingCode: "MVR-2026-TEST",
          tierTitle: "TIER 1 (MAJOR SYSTEMS)"
        });

        if (result?.simulated) {
          showToast(`Test email simulated to ${target} (Dev mode active).`);
        } else if (result?.success) {
          showToast(`Live test email delivered via Resend to ${target}.`);
        } else {
          showToast(`Notice: ${result?.error || "Email queued"}`);
        }
      } catch (e) {
        showToast("Test email error: " + e.message);
      } finally {
        testEmailBtn.textContent = "Send Test Email to Admin";
        testEmailBtn.disabled = false;
      }
    });
  }
}

// ============================================================
// PROVISIONAL SUPPLIER ALLOCATION LETTER (PDF GENERATOR)
// ============================================================

function generateProvisionalAllocationPdf(sub) {
  if (!sub) return;
  if (!window.jspdf?.jsPDF) {
    showToast("PDF generator library is still loading. Please try again in a moment.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const gold = [207, 143, 69];
  const dark = [14, 10, 7];
  const ink = [33, 37, 41];
  const lightGrey = [120, 115, 105];

  // Top luxury accent bar
  doc.setFillColor(...gold);
  doc.rect(0, 0, 210, 6, "F");

  // Header Title & Branding
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...dark);
  doc.text("MUREZA OEM AUTOMOTIVE GROUP", 20, 24);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...gold);
  doc.text("PAN-AFRICAN LOCALIZATION PROGRAM  |  AfCFTA RULES OF ORIGIN FRAMEWORK", 20, 30);

  // Horizontal divider
  doc.setDrawColor(220, 215, 205);
  doc.setLineWidth(0.5);
  doc.line(20, 36, 190, 36);

  // Document Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...dark);
  doc.text("PROVISIONAL SUPPLIER QUALIFICATION & CAPACITY ALLOCATION", 20, 48);

  // Reference & Date Box
  doc.setFillColor(248, 246, 240);
  doc.rect(20, 54, 170, 22, "F");
  doc.setDrawColor(...gold);
  doc.setLineWidth(0.3);
  doc.rect(20, 54, 170, 22, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...gold);
  doc.text("TRACKING REFERENCE:", 26, 62);
  doc.setTextColor(...dark);
  doc.setFontSize(11);
  doc.text(sub.trackingCode || "MVR-2026-0000", 72, 62);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...gold);
  doc.text("ISSUANCE DATE:", 26, 70);
  doc.setTextColor(...dark);
  doc.setFontSize(10);
  doc.text(new Date().toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" }), 72, 70);

  doc.text("STATUS: PROVISIONALLY CERTIFIED", 125, 70);

  // Supplier Details Section
  let y = 88;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...dark);
  doc.text("1. QUALIFIED ENTERPRISE DETAILS", 20, y);
  doc.line(20, y + 2, 190, y + 2);

  y += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...lightGrey);
  doc.text("Company Name:", 20, y);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...dark);
  doc.text(sub.companyName || "N/A", 65, y);

  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...lightGrey);
  doc.text("Registration / Tax ID:", 20, y);
  doc.setTextColor(...dark);
  doc.text(sub.registrationNumber || "N/A", 65, y);

  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...lightGrey);
  doc.text("Country of Operation:", 20, y);
  doc.setTextColor(...dark);
  doc.text(sub.country || "N/A", 65, y);

  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...lightGrey);
  doc.text("Authorized Representative:", 20, y);
  doc.setTextColor(...dark);
  doc.text(`${sub.contactName || "N/A"} (${sub.contactEmail || "N/A"})`, 65, y);

  // Allocation & Scope Section
  y += 15;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...dark);
  doc.text("2. CAPACITY ALLOCATION & COMPONENT SCOPE", 20, y);
  doc.line(20, y + 2, 190, y + 2);

  const assignedTierObj = state.tiers.find((t) => t.id === (sub.assignedTier || sub.selectedTier)) || {
    title: (sub.assignedTier || sub.selectedTier || "TIER 1").toUpperCase(),
    sub: "MAJOR SYSTEMS"
  };

  y += 10;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...lightGrey);
  doc.text("Allocated Tier Category:", 20, y);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...gold);
  doc.text(`${assignedTierObj.title} (${assignedTierObj.sub})`, 65, y);

  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...lightGrey);
  doc.text("Manufacturing Category:", 20, y);
  doc.setTextColor(...dark);
  doc.text(sub.primaryCategory || "Automotive Component Fabrication", 65, y);

  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...lightGrey);
  doc.text("Target Vehicle Platform:", 20, y);
  doc.setTextColor(...dark);
  doc.text("MUREZA Villager EV & Commercial Modular Platform (240 Subsystems)", 65, y);

  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...lightGrey);
  doc.text("AfCFTA Target Domestic Content:", 20, y);
  doc.setTextColor(...dark);
  doc.text("Up to 60% African Domestic Value Addition", 65, y);

  // Regulatory Compliance & Terms
  y += 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...dark);
  doc.text("3. STATUTORY PREREQUISITES & AUDIT SCHEDULE", 20, y);
  doc.line(20, y + 2, 190, y + 2);

  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...ink);
  const termsText =
    "This certificate confirms provisional capacity reservation in the MUREZA continental automotive manufacturing roster under the AfCFTA industrial protocol. Full off-take contracts and CAD tooling allocation remain subject to satisfactory physical site audit, SABS/KEBS/ISO 9001/IATF 16949 quality alignment, and homologation verification. Upfront qualification fees are waived under the current Continental Industrialization Pilot Program.";
  const splitTerms = doc.splitTextToSize(termsText, 170);
  doc.text(splitTerms, 20, y);

  // Sign-off / Seal block
  y += 28;
  doc.setDrawColor(200, 200, 200);
  doc.line(20, y, 90, y);
  doc.line(120, y, 190, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...dark);
  doc.text("DR. TINASHE MUREZA", 20, y + 5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...lightGrey);
  doc.text("Group Managing Director & Founder", 20, y + 9);
  doc.text("MUREZA Auto Manufacturing Ltd", 20, y + 13);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...dark);
  doc.text("TATENDA CHENGETA", 120, y + 5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...lightGrey);
  doc.text("Head of Supply Chain & Localization", 120, y + 9);
  doc.text("MAVE Continental Automotive Group", 120, y + 13);

  // Security Footer
  doc.setFillColor(...dark);
  doc.rect(0, 282, 210, 15, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(200, 190, 180);
  doc.text("OFFICIAL MAVE DOCUMENT  •  CONFIDENTIAL  •  VERIFIABLE AT SUPPLIERS.MAVE.AFRICA", 105, 290, { align: "center" });

  const filename = `MAVE_Supplier_Allocation_${sub.trackingCode || "Certificate"}.pdf`;
  doc.save(filename);
  showToast(`Generated Allocation Letter: ${filename}`);
}

// ============================================================
// DEMO SEED HELPER (FOR FAST TESTING)
// ============================================================

function setupSeedDemo() {
  const seedBtn = document.getElementById("seedDemoBtn");
  if (seedBtn) {
    seedBtn.addEventListener("click", async () => {
      seedBtn.textContent = "Seeding...";
      seedBtn.disabled = true;

      const sampleCompanies = [
        {
          name: "Vaal Stamping & Tooling (Pty) Ltd",
          reg: "2018/489201/07",
          country: "South Africa",
          contact: "Johan Van Der Merwe",
          email: "johan@vaalstamping.co.za",
          phone: "+27 16 980 4000",
          cat: "Body Panels, Die Stamping & Tooling",
          tier: "tier-1",
          cap: "Tier 1 automotive press line with 800-ton stamping capacity. Currently supplying structural chassis components and ready for MUREZA Villager localization."
        },
        {
          name: "Rift Valley Cable & Harness Ltd",
          reg: "KE-REG-77391",
          country: "Kenya",
          contact: "Amina Odhiambo",
          email: "amina@riftvalleycables.ke",
          phone: "+254 20 440 8122",
          cat: "High Voltage EV Wiring & Cockpit Harnesses",
          tier: "tier-2",
          cap: "Automotive wire harness assembly plant located in Athi River Special Economic Zone. Specialized in automotive copper braiding and ECU junction connectors."
        },
        {
          name: "Manica Lithium Concentrates",
          reg: "MZ-88204-IND",
          country: "Mozambique",
          contact: "Carlos Machel",
          email: "carlos@manicalithium.mz",
          phone: "+258 21 349 900",
          cat: "Battery-grade Spodumene & Lithium Salts",
          tier: "tier-3",
          cap: "Certified lithium chemical refining facility with 25,000 metric tonne annual concentrate off-take for African battery cell manufacturing."
        }
      ];

      const chosen = sampleCompanies[Math.floor(Math.random() * sampleCompanies.length)];

      // Create dummy file blob
      const dummyFile = new File(
        [`COMPANY PROFILE DOSSIER\n\nCompany: ${chosen.name}\nRegistration: ${chosen.reg}\nCapability: ${chosen.cap}`],
        `${chosen.name.replace(/[^a-z0-9]/gi, "_")}_Company_Profile.pdf`,
        { type: "application/pdf" }
      );

      try {
        const sub = await submitSupplierRegistration(
          {
            companyName: chosen.name,
            registrationNumber: chosen.reg,
            country: chosen.country,
            contactName: chosen.contact,
            contactEmail: chosen.email,
            contactPhone: chosen.phone,
            primaryCategory: chosen.cat,
            selectedTier: chosen.tier,
            capabilitySummary: chosen.cap
          },
          [dummyFile]
        );

        showToast(`Seeded application: ${sub.companyName} (${sub.trackingCode})`);
      } catch (e) {
        showToast("Seed error: " + e.message);
      } finally {
        seedBtn.textContent = "+ Seed Test Application";
        seedBtn.disabled = false;
      }
    });
  }
}

// ============================================================
// HELPERS
// ============================================================

function getTierLabel(tierId) {
  if (!tierId) return "Unassigned";
  const t = state.tiers.find((tier) => tier.id === tierId || tier.code === tierId);
  return t ? t.title : tierId.toUpperCase();
}

function formatStatus(status) {
  switch (status) {
    case "pending":
      return "Pending Review";
    case "under_review":
      return "Under Review";
    case "tier_assigned":
      return "Tier Assigned";
    case "approved":
      return "Approved";
    case "declined":
      return "Declined";
    default:
      return (status || "Pending").toUpperCase();
  }
}

function formatCurrency(amount, currency = "ZAR") {
  const num = Number(amount) || 0;
  if (currency === "USD") return `$${num.toLocaleString()}`;
  return `R ${num.toLocaleString()}`;
}

function formatFileSize(bytes) {
  if (!bytes) return "PDF Document";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function formatDate(iso) {
  if (!iso) return "Just now";
  try {
    let d;
    if (typeof iso === "object" && typeof iso.toDate === "function") {
      d = iso.toDate();
    } else if (typeof iso === "object" && iso.seconds) {
      d = new Date(iso.seconds * 1000);
    } else {
      d = new Date(iso);
    }
    if (isNaN(d.getTime())) return "Recent";
    return d.toLocaleDateString("en-ZA", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  } catch (e) {
    return "Recent";
  }
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showToast(message) {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const t = document.createElement("div");
  t.className = "toast";
  t.innerHTML = `<span class="toast-dot"></span><span>${escapeHtml(message)}</span>`;
  container.appendChild(t);

  setTimeout(() => {
    t.style.opacity = "0";
    t.style.transition = "opacity 0.4s ease";
    setTimeout(() => t.remove(), 400);
  }, 4000);
}

// ============================================================
// TENDERS & BIDDING MANAGEMENT (CLIENT REQUIREMENT)
// ============================================================

function setupTendersTab() {
  const filterBtns = document.querySelectorAll(".tender-filter-btn");
  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterBtns.forEach((b) => {
        b.classList.remove("cms-btn-gold");
        b.classList.add("cms-btn-outline");
      });
      btn.classList.add("cms-btn-gold");
      btn.classList.remove("cms-btn-outline");
      state.activeTenderFilter = btn.dataset.tenderFilter || "all";
      renderTendersTab();
    });
  });

  const addBtn = document.getElementById("addNewTenderBtn");
  if (addBtn) {
    addBtn.addEventListener("click", () => window.openTenderEditModal());
  }

  const seedBtn = document.getElementById("seedTendersBtn");
  if (seedBtn) {
    seedBtn.addEventListener("click", async () => {
      if (!confirm("Reset and seed default OEM Villager platform RFPs?")) return;
      await seedDefaultTenders();
      showToast("Default OEM RFPs restored.");
    });
  }
}

function updateTendersMetrics() {
  const openCount = state.tenders.filter((t) => t.status === "open").length;
  const totalBids = state.bids.length;
  const awardedCount = state.bids.filter((b) => b.status === "awarded").length;

  const activeEl = document.getElementById("metricActiveTenders");
  if (activeEl) activeEl.textContent = openCount;

  const bidsEl = document.getElementById("metricTotalBids");
  if (bidsEl) bidsEl.textContent = totalBids;

  const awardedEl = document.getElementById("metricAwardedBids");
  if (awardedEl) awardedEl.textContent = awardedCount;

  const badge = document.getElementById("openTendersBadge");
  if (badge) badge.textContent = openCount;

  const bottomTendersBadge = document.getElementById("bottomTendersBadge");
  if (bottomTendersBadge) bottomTendersBadge.textContent = openCount;

  const allCountEl = document.getElementById("countTendersAll");
  if (allCountEl) allCountEl.textContent = state.tenders.length;

  const openCountEl = document.getElementById("countTendersOpen");
  if (openCountEl) openCountEl.textContent = openCount;

  const evalCountEl = document.getElementById("countTendersEval");
  if (evalCountEl) evalCountEl.textContent = state.tenders.filter((t) => t.status === "evaluation").length;

  const closedCountEl = document.getElementById("countTendersClosed");
  if (closedCountEl) closedCountEl.textContent = state.tenders.filter((t) => t.status === "closed").length;
}

function renderTendersTab() {
  const tbody = document.getElementById("tendersTableBody");
  if (!tbody) return;

  const filter = state.activeTenderFilter || "all";
  const filtered = state.tenders.filter((t) => {
    if (filter === "all") return true;
    return t.status === filter;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; color: var(--ink-faint); padding: 36px;">
          No RFPs matching the current filter. Click "+ Create New Tender" to publish a new RFP.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered
    .map((t) => {
      const bidsForTender = state.bids.filter((b) => b.tenderId === t.id);
      const bidsCount = bidsForTender.length;

      let statusBadgeClass = "tender-status-open";
      let statusLabel = "OPEN";
      if (t.status === "evaluation") {
        statusBadgeClass = "tender-status-eval";
        statusLabel = "EVALUATION";
      } else if (t.status === "closed") {
        statusBadgeClass = "tender-status-closed";
        statusLabel = "CLOSED";
      }

      return `
        <tr>
          <td>
            <span class="tender-ref-cell">${escapeHtml(t.ref || "RFP")}</span>
          </td>
          <td>
            <div class="company-cell">
              <span class="company-name" style="font-size: 13px;">${escapeHtml(t.title)}</span>
              <span style="font-size: 11px; color: var(--gold);">${escapeHtml(t.category)}</span>
            </div>
          </td>
          <td style="font-size: 12px; color: var(--ink-dim);">${escapeHtml(t.volume || "—")}</td>
          <td style="font-family: monospace; font-size: 12px; color: var(--ink);">${escapeHtml(t.estimatedValue || "—")}</td>
          <td>
            <span style="font-weight: 600; color: #4ade80; font-family: monospace;">${t.localContentPct || 50}%</span>
          </td>
          <td style="font-size: 12px; color: var(--ink-dim);">${formatDate(t.deadline)}</td>
          <td>
            <span class="cms-badge ${statusBadgeClass}">${statusLabel}</span>
          </td>
          <td>
            <button class="cms-btn cms-btn-outline" style="padding: 4px 10px; font-size: 11px; display: inline-flex; align-items: center; gap: 6px;" onclick="window.inspectTenderBids('${t.id}')">
              <span>Bids</span>
              <span class="status-pill ${bidsCount > 0 ? "status-approved" : ""}" style="padding: 1px 6px; font-size: 10px;">${bidsCount}</span>
            </button>
          </td>
          <td>
            <div style="display: flex; gap: 6px;">
              <button class="cms-btn cms-btn-outline" style="padding: 4px 8px; font-size: 11px;" onclick="window.editTender('${t.id}')">Edit</button>
              <button class="cms-btn cms-btn-danger" style="padding: 4px 8px; font-size: 11px;" onclick="window.deleteTenderById('${t.id}')" title="Delete Tender">Delete</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function setupTenderModals() {
  const saveBtn = document.getElementById("saveTenderBtn");
  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      const id = document.getElementById("editTenderId").value || `rfp_${Date.now()}`;
      const ref = document.getElementById("tenderEditRef").value.trim();
      const title = document.getElementById("tenderEditTitle").value.trim();
      const category = document.getElementById("tenderEditCategory").value.trim();
      const volume = document.getElementById("tenderEditVolume").value.trim();
      const estimatedValue = document.getElementById("tenderEditEstimatedValue").value.trim();
      const localContentPct = Number(document.getElementById("tenderEditLocalContent").value) || 50;
      const location = document.getElementById("tenderEditLocation").value.trim();
      const deadline = document.getElementById("tenderEditDeadline").value;
      const status = document.getElementById("tenderEditStatus").value || "open";
      const scope = document.getElementById("tenderEditScope").value.trim();
      const requirements = document.getElementById("tenderEditRequirements").value.trim();

      if (!ref || !title) {
        showToast("Please provide reference code and title.");
        return;
      }

      saveBtn.textContent = "Saving...";
      saveBtn.disabled = true;

      try {
        await saveTender({
          id,
          ref,
          title,
          category,
          volume,
          estimatedValue,
          localContentPct,
          location,
          deadline,
          status,
          scope,
          requirements
        });
        showToast(`Tender ${ref} saved successfully.`);
        window.closeTenderEditModal();
      } catch (err) {
        showToast("Error saving tender: " + err.message);
      } finally {
        saveBtn.textContent = "Save Tender";
        saveBtn.disabled = false;
      }
    });
  }

  const editModal = document.getElementById("tenderEditModal");
  if (editModal) {
    editModal.addEventListener("click", (e) => {
      if (e.target === editModal) window.closeTenderEditModal();
    });
  }

  const bidsModal = document.getElementById("tenderBidsModal");
  if (bidsModal) {
    bidsModal.addEventListener("click", (e) => {
      if (e.target === bidsModal) window.closeTenderBidsModal();
    });
  }
}

window.openTenderEditModal = (tender = null) => {
  const modal = document.getElementById("tenderEditModal");
  const title = document.getElementById("tenderModalTitle");
  if (!modal) return;

  if (tender) {
    title.textContent = `Edit RFP: ${tender.ref}`;
    document.getElementById("editTenderId").value = tender.id || "";
    document.getElementById("tenderEditRef").value = tender.ref || "";
    document.getElementById("tenderEditTitle").value = tender.title || "";
    document.getElementById("tenderEditCategory").value = tender.category || "";
    document.getElementById("tenderEditVolume").value = tender.volume || "";
    document.getElementById("tenderEditEstimatedValue").value = tender.estimatedValue || "";
    document.getElementById("tenderEditLocalContent").value = tender.localContentPct || 60;
    document.getElementById("tenderEditLocation").value = tender.location || "South Africa / East Africa SEZ Hubs";
    document.getElementById("tenderEditDeadline").value = tender.deadline || "";
    document.getElementById("tenderEditStatus").value = tender.status || "open";
    document.getElementById("tenderEditScope").value = tender.scope || "";
    document.getElementById("tenderEditRequirements").value = tender.requirements || "";
  } else {
    title.textContent = "Create New RFP Tender";
    const rand = Math.floor(10 + Math.random() * 90);
    document.getElementById("editTenderId").value = "";
    document.getElementById("tenderEditRef").value = `RFP-2026-OEM-${rand}`;
    document.getElementById("tenderEditTitle").value = "";
    document.getElementById("tenderEditCategory").value = "Powertrain & Electrical (Tier 1)";
    document.getElementById("tenderEditVolume").value = "10,000 sets / year";
    document.getElementById("tenderEditEstimatedValue").value = "R 75,000,000 / $4.1M USD";
    document.getElementById("tenderEditLocalContent").value = 60;
    document.getElementById("tenderEditLocation").value = "South Africa / East Africa SEZ Hubs";
    document.getElementById("tenderEditDeadline").value = "2026-12-31";
    document.getElementById("tenderEditStatus").value = "open";
    document.getElementById("tenderEditScope").value = "";
    document.getElementById("tenderEditRequirements").value = "IATF 16949 / ISO 9001 certified readiness, audited raw material supply chain.";
  }

  modal.classList.add("open");
};

window.closeTenderEditModal = () => {
  const modal = document.getElementById("tenderEditModal");
  if (modal) modal.classList.remove("open");
};

window.editTender = (id) => {
  const t = state.tenders.find((item) => item.id === id);
  if (t) window.openTenderEditModal(t);
};

window.deleteTenderById = async (id) => {
  const t = state.tenders.find((item) => item.id === id);
  if (!t) return;
  if (!confirm(`Are you sure you want to delete tender ${t.ref} (${t.title})?`)) return;

  try {
    await deleteTender(id);
    showToast(`Deleted ${t.ref}`);
  } catch (err) {
    showToast("Error deleting tender: " + err.message);
  }
};

window.inspectTenderBids = (tenderId) => {
  const tender = state.tenders.find((t) => t.id === tenderId);
  if (!tender) return;
  state.activeInspectingTender = tender;
  renderTenderBidsModal(tender);
  const modal = document.getElementById("tenderBidsModal");
  if (modal) modal.classList.add("open");
};

window.closeTenderBidsModal = () => {
  const modal = document.getElementById("tenderBidsModal");
  if (modal) modal.classList.remove("open");
  state.activeInspectingTender = null;
};

function renderTenderBidsModal(tender) {
  const refEl = document.getElementById("bidsModalRef");
  if (refEl) refEl.textContent = tender.ref || "RFP";

  const titleEl = document.getElementById("bidsModalTitle");
  if (titleEl) titleEl.textContent = tender.title || "Tender Proposals";

  const scopeEl = document.getElementById("bidsModalScope");
  if (scopeEl) scopeEl.textContent = `${tender.volume || ""} • Target: ${tender.localContentPct || 60}% African Local Content`;

  const container = document.getElementById("tenderBidsListContainer");
  if (!container) return;

  const bids = state.bids.filter((b) => b.tenderId === tender.id);
  const countEl = document.getElementById("bidsModalCount");
  if (countEl) countEl.textContent = `${bids.length} Bid${bids.length === 1 ? "" : "s"} Received`;

  if (bids.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; background: rgba(14, 10, 7, 0.4); border: 1px dashed var(--border); border-radius: var(--radius-sm); color: var(--ink-dim);">
        <p style="font-size: 14px; font-weight: 600; color: var(--ink); margin-bottom: 6px;">No Bids Submitted Yet</p>
        <p style="font-size: 12px; color: var(--ink-faint); margin: 0;">Registered suppliers can submit commercial bids and technical proposals directly from the public portal Tenders section.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = bids
    .map((bid) => {
      const isAwarded = bid.status === "awarded";
      const isShortlisted = bid.status === "shortlisted";
      const isDeclined = bid.status === "declined";

      let statusBadge = `<span class="cms-badge badge-backend">SUBMITTED</span>`;
      if (isAwarded) statusBadge = `<span class="status-pill status-approved">AWARDED CONTRACT</span>`;
      else if (isShortlisted) statusBadge = `<span class="cms-badge" style="background: rgba(207, 143, 69, 0.2); color: var(--gold); border: 1px solid var(--gold);">SHORTLISTED</span>`;
      else if (isDeclined) statusBadge = `<span class="cms-badge" style="background: rgba(230, 57, 70, 0.15); color: #feb2b2; border: 1px solid rgba(230, 57, 70, 0.3);">DECLINED</span>`;

      const proposalDoc = bid.proposalDoc;
      const docHtml = proposalDoc && proposalDoc.url ? `
        <div style="margin-top: 12px; padding: 10px 14px; background: rgba(14, 10, 7, 0.5); border: 1px solid rgba(207, 143, 69, 0.15); border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color: var(--gold);"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <div>
              <div style="font-size: 12px; font-weight: 600; color: var(--ink);">${escapeHtml(proposalDoc.name || "Technical Proposal.pdf")}</div>
              <div style="font-size: 11px; color: var(--ink-faint);">${formatFileSize(proposalDoc.size)} • Uploaded with bid</div>
            </div>
          </div>
          <a href="${proposalDoc.url}" target="_blank" rel="noopener noreferrer" class="cms-btn cms-btn-outline" style="padding: 4px 10px; font-size: 11px;">
            View Quotation PDF ↗
          </a>
        </div>
      ` : "";

      const notesId = `bidNotes_${bid.id}`;

      return `
        <div class="bid-item-card ${isAwarded ? "status-awarded" : ""} ${isShortlisted ? "status-shortlisted" : ""} ${isDeclined ? "status-declined" : ""}">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px;">
            <div>
              <div style="display: flex; align-items: center; gap: 10px;">
                <span class="tender-ref-cell" style="font-size: 14px;">${escapeHtml(bid.bidRef)}</span>
                ${statusBadge}
              </div>
              <h4 style="font-size: 16px; font-weight: 700; color: var(--ink); margin-top: 4px;">${escapeHtml(bid.companyName)}</h4>
              <div style="font-size: 12px; color: var(--ink-dim); margin-top: 2px;">
                Contact: ${escapeHtml(bid.contactName || "—")} • ${escapeHtml(bid.contactEmail || "—")} • ${escapeHtml(bid.contactPhone || "—")}
              </div>
            </div>
            <div style="font-size: 11px; color: var(--ink-faint);">
              Submitted: ${formatDate(bid.submittedAt)}
            </div>
          </div>

          <div class="bid-metrics-grid">
            <div class="bid-metric-box">
              <span class="bid-metric-kicker">Proposed Unit Price</span>
              <span class="bid-metric-val" style="color: var(--gold);">${formatCurrency(bid.proposedUnitCost, bid.currency)}</span>
            </div>
            <div class="bid-metric-box">
              <span class="bid-metric-kicker">Tooling / Capex</span>
              <span class="bid-metric-val">${formatCurrency(bid.toolingCost, bid.currency)}</span>
            </div>
            <div class="bid-metric-box">
              <span class="bid-metric-kicker">Production Lead Time</span>
              <span class="bid-metric-val">${bid.leadTimeWeeks || 12} Weeks</span>
            </div>
            <div class="bid-metric-box">
              <span class="bid-metric-kicker">Pledged Local Content</span>
              <span class="bid-metric-val" style="color: #4ade80;">${bid.localContentPct || 50}%</span>
            </div>
          </div>

          ${bid.technicalNotes ? `
            <div style="margin: 12px 0; font-size: 12px; color: var(--ink-dim); background: rgba(14, 10, 7, 0.4); padding: 10px 14px; border-radius: 4px; border-left: 2px solid var(--gold);">
              <span style="font-weight: 600; color: var(--ink);">Technical Statement:</span> ${escapeHtml(bid.technicalNotes)}
            </div>
          ` : ""}

          ${docHtml}

          <!-- Reviewer decision box -->
          <div style="margin-top: 16px; padding-top: 14px; border-top: 1px solid rgba(207, 143, 69, 0.15); display: flex; flex-direction: column; gap: 10px;">
            <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
              <input type="text" id="${notesId}" class="form-input" placeholder="Evaluation notes / award terms..." value="${escapeHtml(bid.reviewerNotes || "")}" style="flex: 1; min-width: 200px; font-size: 12px; padding: 8px 12px;">
              <button class="cms-btn cms-btn-outline" style="padding: 8px 14px; font-size: 11px; border-color: rgba(207, 143, 69, 0.5); color: var(--gold);" onclick="window.updateBidDecision('${bid.id}', 'shortlisted', '${notesId}')">
                Shortlist
              </button>
              <button class="cms-btn cms-btn-gold" style="padding: 8px 14px; font-size: 11px;" onclick="window.updateBidDecision('${bid.id}', 'awarded', '${notesId}')">
                Award Tender
              </button>
              <button class="cms-btn cms-btn-danger" style="padding: 8px 14px; font-size: 11px;" onclick="window.updateBidDecision('${bid.id}', 'declined', '${notesId}')">
                Decline
              </button>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

window.updateBidDecision = async (bidId, status, notesInputId) => {
  const notesEl = document.getElementById(notesInputId);
  const notes = notesEl ? notesEl.value.trim() : "";

  try {
    await updateBidStatus(bidId, status, notes);
    showToast(`Bid status updated to: ${status.toUpperCase()}`);
    if (state.activeInspectingTender) {
      renderTenderBidsModal(state.activeInspectingTender);
    }
  } catch (err) {
    showToast("Error updating bid: " + err.message);
  }
};

