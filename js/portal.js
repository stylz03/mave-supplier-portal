/* ============================================================
   MUREZA / MAVE Supplier Portal — Main Frontend Controller
   Connects index.html to real-time Firebase Firestore content,
   dynamic tiers, interactive registration modal with file uploads,
   and applicant status tracking.
   ============================================================ */

import {
  onSiteContentSnapshot,
  onTiersSnapshot,
  submitSupplierRegistration,
  onSubmissionsSnapshot,
  onTendersSnapshot,
  submitTenderBid,
  DEFAULT_PAGE_CONTENT,
  DEFAULT_TIERS,
  DEFAULT_TENDERS
} from "./firebase-client.js";

let currentContent = { ...DEFAULT_PAGE_CONTENT };
let currentTiers = [...DEFAULT_TIERS];
let currentTenders = [...DEFAULT_TENDERS];
let allSubmissions = [];
let selectedFiles = [];
let selectedBidFile = null;
let currentTenderFilter = "all";

document.addEventListener("DOMContentLoaded", () => {
  setupNavigation();
  setupRegistrationModal();
  setupDetailsModal();
  setupTrackingLookup();
  setupTendersSection();
  setupTenderBidModal();

  // 1. Listen for real-time Page Content
  onSiteContentSnapshot((content) => {
    currentContent = content;
    applyContentUpdates(content);
    if (currentTiers.length > 0) {
      renderTiersSection(currentTiers);
      populateModalTierOptions(currentTiers);
    }
  });

  // 2. Listen for real-time Tiers
  onTiersSnapshot((tiers) => {
    currentTiers = tiers;
    renderHeroServiceBar(tiers);
    renderTiersSection(tiers);
    populateModalTierOptions(tiers);
  });

  // 3. Listen for Submissions
  onSubmissionsSnapshot((submissions) => {
    allSubmissions = submissions;
  });

  // 4. Listen for real-time Tenders
  onTendersSnapshot((tenders) => {
    currentTenders = tenders;
    renderPortalTenders(tenders);
  });
});

// ============================================================
// DYNAMIC CONTENT UPDATES
// ============================================================

function applyContentUpdates(content) {
  // Hero text
  const displayWord = document.querySelector(".display-word");
  const displayWordFront = document.getElementById("wordFront");
  if (displayWord && content.displayWord) displayWord.textContent = content.displayWord;
  if (displayWordFront && content.displayWord) displayWordFront.textContent = content.displayWord;

  const kicker = document.querySelector(".kicker");
  if (kicker && content.kicker) kicker.textContent = content.kicker;

  const headline = document.querySelector(".headline");
  if (headline && content.headline) headline.textContent = content.headline;

  const tagline = document.querySelector(".tagline");
  if (tagline && content.tagline) tagline.textContent = content.tagline;

  const brandName = document.querySelector(".brand-name");
  if (brandName && content.brandName) brandName.textContent = content.brandName;

  // Overview / Strategic section
  const ovKicker = document.getElementById("dynOverviewKicker");
  if (ovKicker && content.overviewKicker) ovKicker.textContent = content.overviewKicker;

  const ovHeadline = document.getElementById("dynOverviewHeadline");
  if (ovHeadline && content.overviewHeadline) ovHeadline.textContent = content.overviewHeadline;

  const ovBody = document.getElementById("dynOverviewBody");
  if (ovBody && content.overviewBody) ovBody.textContent = content.overviewBody;

  // Contact
  const contactEl = document.getElementById("footerContactEmail");
  if (contactEl && content.contactEmail) {
    contactEl.textContent = content.contactEmail;
    contactEl.href = `mailto:${content.contactEmail}`;
  }

  // Pillars
  renderStrategicPillars(content.pillars || DEFAULT_PAGE_CONTENT.pillars);
}

function renderStrategicPillars(pillars) {
  const container = document.getElementById("strategicPillarsContainer");
  if (!container) return;

  container.innerHTML = pillars
    .map(
      (p, i) => `
    <div class="strategic-pillar-card">
      <div class="pillar-code">${p.code || "0" + (i + 1)}</div>
      <h3 class="pillar-title">${escapeHtml(p.title)}</h3>
      <p class="pillar-desc">${escapeHtml(p.desc)}</p>
    </div>
  `
    )
    .join("");
}

// ============================================================
// HERO SERVICE BAR (BOTTOM TIER BAR)
// ============================================================

function renderHeroServiceBar(tiers) {
  const bar = document.querySelector(".service-bar");
  if (!bar) return;

  const totalPartners = tiers.reduce((acc, t) => acc + (Number(t.capacity) || 0), 0);

  const tiersHtml = tiers
    .slice(0, 5)
    .map((tier, idx) => {
      const numFormatted = String(tier.capacity || 10).padStart(2, "0");
      const isGold = idx === 0 || tier.color === "#cf8f45";
      return `
      <div class="service service-${idx + 1}" onclick="window.scrollToTier('${tier.id}')" title="Explore ${tier.title}">
        <span class="num">${numFormatted}</span>
        <span class="stack">
          <span class="s-title">${escapeHtml(tier.title)}</span>
          <span class="s-sub ${isGold ? "gold" : ""}">${escapeHtml(tier.sub || "")}</span>
        </span>
      </div>
      <span class="sep sep-${idx + 1}" aria-hidden="true"></span>
    `;
    })
    .join("");

  bar.innerHTML = `
    ${tiersHtml}
    <div class="total-suppliers" onclick="window.scrollToSection('tiers-section')">
      <span class="tot-title">TOTAL</span>
      <span class="tot-num">${totalPartners || 50}</span>
    </div>
  `;
}

// ============================================================
// TIERS & PRICING SECTION
// ============================================================

function renderTiersSection(tiers) {
  const grid = document.getElementById("portalTiersGrid");
  if (!grid) return;

  grid.innerHTML = tiers
    .map((tier) => {
      const focusList = Array.isArray(tier.focus) ? tier.focus : (tier.focus || "").split("\n").filter(Boolean);
      const remainingSlots = Math.max(0, (Number(tier.capacity) || 10) - (Number(tier.filled) || 0));
      const feesEnabled = currentContent?.tierFeesEnabled === true;

      return `
      <div class="portal-tier-card" id="tier-card-${tier.id}" style="border-top: 3px solid ${tier.color || "var(--gold)"};">
        <div class="portal-tier-top">
          <span class="portal-tier-badge" style="color: ${tier.color || "var(--gold)"};">
            ${escapeHtml(tier.code || tier.title)}
          </span>
          <span class="portal-tier-capacity">
            ${remainingSlots} of ${tier.capacity || 10} Slots Open
          </span>
        </div>

        <h3 class="portal-tier-title">${escapeHtml(tier.title)}</h3>
        <p class="portal-tier-sub" style="color: ${tier.color || "var(--gold)"};">${escapeHtml(tier.sub)}</p>

        <!-- Pricing info configured from CMS (Waived for Pilot Onboarding) -->
        <div class="portal-tier-pricing-box">
          <div>
            <div class="portal-pricing-term">
              ${feesEnabled ? escapeHtml(tier.feeFrequency || "Once-off Qualification Fee") : "AfCFTA Pilot Onboarding"}
            </div>
            <div class="portal-pricing-amount" style="${!feesEnabled ? "color: var(--gold-light);" : ""}">
              ${
                feesEnabled
                  ? escapeHtml(tier.feeFormatted || "R " + (tier.feeAmount || 30000).toLocaleString())
                  : `Fee Waived <span style="font-size: 11px; font-weight: normal; color: var(--ink-faint);">(100% Sponsored)</span>`
              }
            </div>
          </div>
          <span style="font-size: 10px; letter-spacing: 0.1em; color: ${feesEnabled ? "var(--gold)" : "#68d391"}; font-weight: 700; text-transform: uppercase;">
            ${feesEnabled ? "REGISTRATION FEE" : "PILOT ONBOARDING"}
          </span>
        </div>

        <div class="portal-tier-focus-title">Target Components &amp; Scope:</div>
        <ul class="portal-tier-focus-list">
          ${focusList.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}
        </ul>

        <button class="portal-tier-cta-btn" onclick="window.openRegistrationForTier('${tier.id}')">
          Register for ${escapeHtml(tier.title)} &nbsp; ↗
        </button>
      </div>
    `;
    })
    .join("");
}

// ============================================================
// SMOOTH NAVIGATION & SCROLLING
// ============================================================

function setupNavigation() {
  // Nav links
  const navMap = {
    ".nav-services": "strategic-section",
    ".nav-performance": "tiers-section",
    ".nav-tenders": "tenders-section",
    ".nav-atelier": "strategic-section",
    ".nav-journal": "tracking-section"
  };

  Object.entries(navMap).forEach(([sel, targetId]) => {
    const el = document.querySelector(sel);
    if (el) {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        window.scrollToSection(targetId);
      });
    }
  });

  // Catch all navigation links in the header
  document.querySelectorAll("header nav a").forEach((link) => {
    link.addEventListener("click", (e) => {
      const href = link.getAttribute("href") || "";
      if (href.startsWith("#") && href.length > 1) {
        e.preventDefault();
        window.scrollToSection(href.substring(1));
      }
    });
  });

  // Explore program button in hero
  const exploreBtn = document.querySelector(".explore");
  if (exploreBtn) {
    exploreBtn.addEventListener("click", (e) => {
      e.preventDefault();
      window.scrollToSection("tiers-section");
    });
  }

  // CTA Join Network button in header
  const ctaBtn = document.querySelector("header .cta");
  if (ctaBtn) {
    ctaBtn.addEventListener("click", (e) => {
      e.preventDefault();
      window.openRegistrationForTier();
    });
  }
}

window.scrollToSection = (sectionId) => {
  const sec = document.getElementById(sectionId);
  if (sec) {
    const y = sec.getBoundingClientRect().top + window.pageYOffset - 30;
    window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
  } else {
    // Scroll past hero
    const hero = document.getElementById("heroContainer");
    if (hero) {
      window.scrollTo({ top: hero.offsetHeight, behavior: "smooth" });
    }
  }
};

window.scrollToTier = (tierId) => {
  const el = document.getElementById(`tier-card-${tierId}`);
  if (el) {
    const y = el.getBoundingClientRect().top + window.pageYOffset - 50;
    window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
    el.style.boxShadow = "0 0 30px rgba(207, 143, 69, 0.5)";
    setTimeout(() => {
      el.style.boxShadow = "";
    }, 2000);
  } else {
    window.scrollToSection("tiers-section");
  }
};

// ============================================================
// REGISTRATION & DOCUMENT UPLOAD MODAL
// ============================================================

function setupRegistrationModal() {
  const modal = document.getElementById("regModal");
  const form = document.getElementById("supplierRegForm");
  const fileInput = document.getElementById("regFileInput");
  const dropzone = document.getElementById("regDropzone");
  const filesList = document.getElementById("selectedFilesList");

  // Dropzone click
  if (dropzone && fileInput) {
    dropzone.addEventListener("click", () => fileInput.click());

    // Drag and drop
    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.classList.add("dragover");
    });
    dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.classList.remove("dragover");
      if (e.dataTransfer.files?.length) {
        handleFileSelection(e.dataTransfer.files);
      }
    });

    fileInput.addEventListener("change", () => {
      if (fileInput.files?.length) {
        handleFileSelection(fileInput.files);
      }
    });
  }

  function handleFileSelection(files) {
    selectedFiles = Array.from(files);
    renderSelectedFiles();
  }

  function renderSelectedFiles() {
    if (!filesList) return;
    if (selectedFiles.length === 0) {
      filesList.innerHTML = "";
      return;
    }
    filesList.innerHTML = selectedFiles
      .map(
        (f) => `
      <div class="file-pill">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -1px; margin-right: 6px; color: var(--gold);"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        <span>${escapeHtml(f.name)} (${formatFileSize(f.size)})</span>
      </div>
    `
      )
      .join("");
  }

  // Update dynamic registration fee when tier selection changes
  const tierSelect = document.getElementById("regTierSelect");
  if (tierSelect) {
    tierSelect.addEventListener("change", () => {
      updateModalFeeDisplay(tierSelect.value);
    });
  }

  // Form submission
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById("regSubmitBtn");
      submitBtn.textContent = "Uploading & Submitting...";
      submitBtn.disabled = true;

      const formData = {
        companyName: document.getElementById("regCompanyName").value,
        registrationNumber: document.getElementById("regRegNumber").value,
        country: document.getElementById("regCountry").value,
        website: document.getElementById("regWebsite").value,
        yearEstablished: document.getElementById("regYear").value,
        contactName: document.getElementById("regContactName").value,
        contactEmail: document.getElementById("regContactEmail").value,
        contactPhone: document.getElementById("regContactPhone").value,
        contactRole: document.getElementById("regContactRole").value,
        primaryCategory: document.getElementById("regCategory").value,
        selectedTier: document.getElementById("regTierSelect").value,
        capabilitySummary: document.getElementById("regCapability").value
      };

      try {
        const result = await submitSupplierRegistration(formData, selectedFiles);

        // Show confirmation screen
        showRegistrationSuccess(result);
      } catch (err) {
        alert("Submission notice: " + err.message);
        submitBtn.textContent = "Submit Application & Upload Dossier ↗";
        submitBtn.disabled = false;
      }
    });
  }

  // Backdrop dismiss
  const regModal = document.getElementById("regModal");
  if (regModal) {
    regModal.addEventListener("click", (e) => {
      if (e.target === regModal) window.closeRegistrationModal();
    });
  }
}

function updateModalFeeDisplay(tierId) {
  const feeEl = document.getElementById("modalTierFeeDisplay");
  if (!feeEl) return;
  const feesEnabled = currentContent?.tierFeesEnabled === true;
  const tier = currentTiers.find((t) => t.id === tierId);

  if (feesEnabled && tier) {
    feeEl.innerHTML = `${escapeHtml(tier.feeFormatted || "R " + tier.feeAmount)} <span style="font-size: 11px; color: var(--ink-faint); font-weight: normal;">(${escapeHtml(tier.feeFrequency || "Once-off")})</span>`;
  } else {
    feeEl.innerHTML = `<span style="color: #68d391; font-weight: 700;">Waived — AfCFTA Pilot Program ($0 / Free)</span>`;
  }
}

function populateModalTierOptions(tiers) {
  const select = document.getElementById("regTierSelect");
  if (!select) return;
  const feesEnabled = currentContent?.tierFeesEnabled === true;

  select.innerHTML = tiers
    .map(
      (t) => `
    <option value="${t.id}">${escapeHtml(t.title)} (${escapeHtml(t.sub)}) — ${feesEnabled ? "Fee: " + escapeHtml(t.feeFormatted || "R " + t.feeAmount) : "AfCFTA Pilot Onboarding (Fee Waived)"}</option>
  `
    )
    .join("");
}

window.openRegistrationForTier = (tierId = null) => {
  const modal = document.getElementById("regModal");
  const formScreen = document.getElementById("regFormScreen");
  const successScreen = document.getElementById("regSuccessScreen");

  if (formScreen) formScreen.style.display = "block";
  if (successScreen) successScreen.style.display = "none";

  const tierSelect = document.getElementById("regTierSelect");
  if (tierSelect) {
    if (tierId) tierSelect.value = tierId;
    updateModalFeeDisplay(tierSelect.value);
  }

  modal.classList.add("open");
};

window.closeRegistrationModal = () => {
  document.getElementById("regModal").classList.remove("open");
};

function showRegistrationSuccess(submission) {
  const formScreen = document.getElementById("regFormScreen");
  const successScreen = document.getElementById("regSuccessScreen");

  if (formScreen) formScreen.style.display = "none";
  if (successScreen) {
    successScreen.style.display = "block";
    document.getElementById("successTrackingCode").textContent = submission.trackingCode;
    document.getElementById("successCompanyName").textContent = submission.companyName;
    document.getElementById("successTier").textContent = getTierTitle(submission.selectedTier);
  }
}

// ============================================================
// DETAILS & VEHICLE DISMANTLING HOTSPOT MODAL
// ============================================================

function setupDetailsModal() {
  const hotspot = document.querySelector(".hotspot");
  const hotspotLabel = document.querySelector(".hotspot-label");

  const openHotspot = () => {
    const modal = document.getElementById("vehicleDetailsModal");
    if (modal) {
      modal.classList.add("open");
      if (typeof window.initVillagerDigitalTwin === "function") {
        setTimeout(() => window.initVillagerDigitalTwin("twin3DCanvasContainer"), 40);
      }
    }
  };

  window.openVehicleDetailsModal = openHotspot;

  if (hotspot) hotspot.addEventListener("click", openHotspot);
  if (hotspotLabel) hotspotLabel.addEventListener("click", openHotspot);

  // Backdrop dismiss
  const modal = document.getElementById("vehicleDetailsModal");
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) window.closeDetailsModal();
    });
  }
}

window.closeDetailsModal = () => {
  const modal = document.getElementById("vehicleDetailsModal");
  if (modal) modal.classList.remove("open");
};

// ============================================================
// APPLICANT STATUS TRACKING LOOKUP
// ============================================================

function setupTrackingLookup() {
  const form = document.getElementById("trackingSearchForm");
  const resultCard = document.getElementById("trackingResultCard");

  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const query = (document.getElementById("trackingSearchInput").value || "").trim().toLowerCase();
      if (!query) return;

      const found = allSubmissions.find(
        (s) =>
          (s.trackingCode || "").toLowerCase() === query ||
          (s.contactEmail || "").toLowerCase() === query ||
          (s.companyName || "").toLowerCase().includes(query)
      );

      if (!resultCard) return;

      if (found) {
        resultCard.style.display = "block";
        resultCard.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
            <div>
              <span style="font-size: 11px; letter-spacing: 0.12em; color: var(--gold); font-weight: 700;">TRACKING: ${escapeHtml(found.trackingCode)}</span>
              <h4 style="font-size: 18px; color: var(--ink); margin-top: 2px;">${escapeHtml(found.companyName)}</h4>
            </div>
            <span class="portal-tier-badge" style="background: rgba(207,143,69,0.15); color: var(--gold);">
              ${formatStatus(found.status)}
            </span>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13px; margin-bottom: 16px;">
            <div><span style="color: var(--ink-faint);">Applied Tier:</span> ${getTierTitle(found.selectedTier)}</div>
            <div><span style="color: var(--ink-faint);">Assigned Tier:</span> <strong style="color: var(--gold);">${getTierTitle(found.assignedTier)}</strong></div>
            <div><span style="color: var(--ink-faint);">Submitted Date:</span> ${formatDate(found.submittedAt)}</div>
            <div><span style="color: var(--ink-faint);">Documents Verified:</span> ${found.documents ? found.documents.length : 0} uploaded</div>
          </div>

          ${
            found.reviewerNotes
              ? `<div style="background: rgba(207,143,69,0.06); border: 1px solid rgba(207,143,69,0.2); padding: 12px; border-radius: 4px; font-size: 12px; color: var(--ink-dim);">
                  <strong style="color: var(--gold);">Reviewer Assessment:</strong> ${escapeHtml(found.reviewerNotes)}
                </div>`
              : `<div style="font-size: 12px; color: var(--ink-faint);">Your dossier is currently undergoing technical and homologation review. You will be contacted once evaluation completes.</div>`
          }
        `;
      } else {
        resultCard.style.display = "block";
        resultCard.innerHTML = `
          <div style="color: #f87171; font-size: 13px; text-align: center; padding: 12px;">
            No application found matching "<strong>${escapeHtml(query)}</strong>". Please verify your Tracking Code (e.g. MVR-2026-XXXX) or registered email.
          </div>
        `;
      }
    });
  }
}

// ============================================================
// 5. TENDERS & RFPs SHOWCASE
// ============================================================

function setupTendersSection() {
  const filterBtns = document.querySelectorAll(".tender-filter-btn");
  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentTenderFilter = btn.dataset.filter || "all";
      renderPortalTenders(currentTenders);
    });
  });
}

function renderPortalTenders(tenders) {
  const container = document.getElementById("portalTendersContainer");
  const countAll = document.getElementById("portalTendersCountAll");
  if (countAll) countAll.textContent = tenders.length;
  if (!container) return;

  const filtered = tenders.filter((t) => {
    if (!currentTenderFilter || currentTenderFilter === "all") return true;
    const cat = (t.category || "").toLowerCase();
    const filter = currentTenderFilter.toLowerCase().replace(/&amp;/g, "&");
    const terms = filter.split(/\s+and\s+|\s*&\s*|\s+/).filter((term) => term.length > 2);
    return terms.some((term) => cat.includes(term));
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; color: var(--ink-faint); padding: 40px; background: rgba(20, 16, 12, 0.5); border: 1px dashed rgba(207,143,69,0.2); border-radius: var(--radius-sm);">
        No tenders currently open in this category. Check back soon or register your capabilities to receive RFP invitations.
      </div>
    `;
    return;
  }

  container.innerHTML = filtered
    .map(
      (tender) => `
    <div class="tender-card">
      <div>
        <div class="tender-header-row">
          <span class="tender-ref-badge">${escapeHtml(tender.ref || "RFP-2026")}</span>
          <span class="tender-status-badge">${(tender.status || "open").toUpperCase().replace(/_/g, " ")}</span>
        </div>

        <h3 class="tender-title">${escapeHtml(tender.title)}</h3>
        <p class="tender-category">${escapeHtml(tender.category || "OEM Work Package")}</p>

        <div class="tender-meta-grid">
          <div>
            <div class="tender-meta-label">Annual Volume</div>
            <div class="tender-meta-val">${escapeHtml(tender.volume || "Annual contract")}</div>
          </div>
          <div>
            <div class="tender-meta-label">AfCFTA Local Content</div>
            <div class="tender-meta-val" style="color: var(--gold);">Min. ${tender.localContentPct || 50}%</div>
          </div>
          <div>
            <div class="tender-meta-label">Est. Package Value</div>
            <div class="tender-meta-val">${escapeHtml(tender.estimatedValue || "Negotiable")}</div>
          </div>
          <div>
            <div class="tender-meta-label">Delivery SEZ Hub</div>
            <div class="tender-meta-val">${escapeHtml(tender.location || "SEZ Hub")}</div>
          </div>
        </div>

        <p class="tender-scope-text">${escapeHtml(tender.scope || "")}</p>
      </div>

      <div class="tender-action-row">
        <div class="tender-deadline-box">
          Bids Close: <span class="tender-deadline-val">${formatDate(tender.deadline)}</span>
        </div>
        <button type="button" class="portal-tier-cta-btn" style="width: auto; padding: 10px 18px; font-size: 11px;" onclick="window.openTenderBidModal('${tender.id}')">
          Submit Proposal &rarr;
        </button>
      </div>
    </div>
  `
    )
    .join("");
}

// ============================================================
// 6. TENDER BID SUBMISSION MODAL
// ============================================================

window.openTenderBidModal = (tenderId = null) => {
  const modal = document.getElementById("tenderBidModal");
  if (!modal) return;

  const tender = currentTenders.find((t) => t.id === tenderId) || currentTenders[0];
  if (tender) {
    document.getElementById("bidFormTenderId").value = tender.id;
    document.getElementById("bidFormTenderRef").value = tender.ref;
    document.getElementById("bidFormTenderTitle").value = tender.title;
    document.getElementById("bidModalTenderRef").textContent = tender.ref;
    document.getElementById("bidModalTenderTitle").textContent = tender.title;
    document.getElementById("bidLocalContentPct").value = tender.localContentPct || 60;
  }

  document.getElementById("bidModalFormScreen").style.display = "block";
  document.getElementById("bidSuccessScreen").style.display = "none";
  selectedBidFile = null;
  const pill = document.getElementById("bidFileSelectedPill");
  if (pill) pill.innerHTML = "";

  modal.classList.add("open");
};

window.closeTenderBidModal = () => {
  const modal = document.getElementById("tenderBidModal");
  if (modal) modal.classList.remove("open");
  selectedBidFile = null;
};

function setupTenderBidModal() {
  const modal = document.getElementById("tenderBidModal");
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) window.closeTenderBidModal();
    });
  }

  // Quick autofill from tracking lookup
  const autofillBtn = document.getElementById("bidAutofillBtn");
  const quickInput = document.getElementById("bidQuickLookupInput");
  if (autofillBtn && quickInput) {
    autofillBtn.addEventListener("click", () => {
      const code = quickInput.value.trim().toLowerCase();
      if (!code) return;
      const found = allSubmissions.find(
        (s) =>
          (s.trackingCode || "").toLowerCase() === code ||
          (s.contactEmail || "").toLowerCase() === code ||
          (s.companyName || "").toLowerCase().includes(code)
      );
      if (found) {
        document.getElementById("bidCompanyName").value = found.companyName || "";
        document.getElementById("bidContactName").value = found.contactName || "";
        document.getElementById("bidContactEmail").value = found.contactEmail || "";
        document.getElementById("bidContactPhone").value = found.contactPhone || "";
        if (found.capabilitySummary) {
          document.getElementById("bidTechnicalNotes").value = found.capabilitySummary;
        }
        autofillBtn.textContent = "Autofilled!";
        setTimeout(() => (autofillBtn.textContent = "Autofill Details"), 2000);
      } else {
        alert("No supplier dossier found matching that code. You can enter details manually below.");
      }
    });
  }

  // File dropzone
  const fileInput = document.getElementById("bidFileInput");
  const filePill = document.getElementById("bidFileSelectedPill");
  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) {
        selectedBidFile = e.target.files[0];
        filePill.innerHTML = `
          <div class="file-pill">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--gold);"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <span>${escapeHtml(selectedBidFile.name)} (${formatFileSize(selectedBidFile.size)})</span>
          </div>
        `;
      }
    });
  }

  // Form submit
  const form = document.getElementById("tenderBidForm");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById("bidSubmitBtn");
      submitBtn.textContent = "Submitting Proposal...";
      submitBtn.disabled = true;

      const bidData = {
        tenderId: document.getElementById("bidFormTenderId").value,
        tenderRef: document.getElementById("bidFormTenderRef").value,
        tenderTitle: document.getElementById("bidFormTenderTitle").value,
        supplierTrackingCode: document.getElementById("bidQuickLookupInput")?.value?.trim() || "",
        companyName: document.getElementById("bidCompanyName").value.trim(),
        contactName: document.getElementById("bidContactName").value.trim(),
        contactEmail: document.getElementById("bidContactEmail").value.trim(),
        contactPhone: document.getElementById("bidContactPhone").value.trim(),
        proposedUnitCost: document.getElementById("bidUnitCost").value,
        currency: document.getElementById("bidCurrency").value,
        toolingCost: document.getElementById("bidToolingCost").value || 0,
        leadTimeWeeks: document.getElementById("bidLeadTimeWeeks").value,
        localContentPct: document.getElementById("bidLocalContentPct").value,
        technicalNotes: document.getElementById("bidTechnicalNotes").value.trim()
      };

      try {
        const fullBid = await submitTenderBid(bidData, selectedBidFile);
        document.getElementById("bidModalFormScreen").style.display = "none";
        document.getElementById("bidSuccessScreen").style.display = "block";
        document.getElementById("bidSuccessCompanyName").textContent = fullBid.companyName;
        document.getElementById("bidSuccessTenderRef").textContent = fullBid.tenderRef;
        document.getElementById("bidSuccessCode").textContent = fullBid.bidRef;
        form.reset();
        selectedBidFile = null;
        if (filePill) filePill.innerHTML = "";
      } catch (err) {
        alert("Error submitting proposal: " + err.message);
      } finally {
        submitBtn.textContent = "Submit Official Tender Proposal →";
        submitBtn.disabled = false;
      }
    });
  }
}

// ============================================================
// HELPERS
// ============================================================

function getTierTitle(tierId) {
  if (!tierId) return "Pending Assignment";
  const t = currentTiers.find((tier) => tier.id === tierId || tier.code === tierId);
  return t ? t.title : tierId.toUpperCase();
}

function formatStatus(status) {
  switch (status) {
    case "pending":
      return "PENDING REVIEW";
    case "under_review":
      return "UNDER TECHNICAL REVIEW";
    case "tier_assigned":
      return "TIER ASSIGNED";
    case "approved":
      return "APPROVED SUPPLIER";
    case "declined":
      return "DECLINED";
    default:
      return (status || "PENDING").toUpperCase();
  }
}

function formatFileSize(bytes) {
  if (!bytes) return "PDF";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-ZA", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  } catch (e) {
    return iso;
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
