/* ============================================================
   MUREZA / MAVE Supplier Portal — Firebase Client & Data Service
   Connects to the mave-invest-prod Firebase ecosystem.
   Provides real-time Firestore synchronization for:
     1. Page Content (Headlines, Taglines, Messaging)
     2. Tiers & Pricing (Capacity, Fees, Focus Areas)
     3. Supplier Registrations & Document Uploads
     4. Admin Notifications & Document Review
   Includes full offline/localStorage fallback for instant resilience.
   ============================================================ */

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// --- Production Firebase Configuration (mave-invest-prod) ---
// Note: To protect against public scanner alerts on open repos,
// apiKey is dynamically resolved from:
// 1. window.__FIREBASE_CONFIG__ (injected via deployment/hosting)
// 2. localStorage.getItem("mureza_firebase_api_key")
// 3. Runtime fetch from /firebase-config.json (local / server gitignored)
export const FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "mave-invest-prod.firebaseapp.com",
  projectId: "mave-invest-prod",
  storageBucket: "mave-invest-prod.firebasestorage.app",
  messagingSenderId: "232846359973",
  appId: "1:232846359973:web:da161596081b9621f63c4c"
};

let app = null;
let db = null;
let storage = null;
let auth = null;
let isConnected = false;

function resolveApiKey() {
  if (typeof window !== "undefined") {
    if (window.__FIREBASE_CONFIG__?.apiKey) return window.__FIREBASE_CONFIG__.apiKey;
    const local = localStorage.getItem("mureza_firebase_api_key");
    if (local) return local;
  }
  return "";
}

export function initFirebase(customKey) {
  const key = customKey || resolveApiKey();
  if (!key) return false;
  FIREBASE_CONFIG.apiKey = key;

  try {
    const existingApps = getApps();
    const named = existingApps.find((a) => a.name === "MaveSupplierPortal");
    if (named) {
      app = named;
    } else {
      app = initializeApp(FIREBASE_CONFIG, "MaveSupplierPortal");
    }
    db = getFirestore(app);
    storage = getStorage(app);
    try { auth = getAuth(app); } catch (e) {}
    isConnected = true;
    console.log("[Firebase] Initialized connection to mave-invest-prod");
    attachAllFirestoreListeners();
    return true;
  } catch (err) {
    try {
      const existingApps = getApps();
      if (existingApps.length > 0) {
        app = existingApps[0];
      } else {
        app = initializeApp(FIREBASE_CONFIG);
      }
      db = getFirestore(app);
      storage = getStorage(app);
      try { auth = getAuth(app); } catch (e) {}
      isConnected = true;
      attachAllFirestoreListeners();
      return true;
    } catch (e) {
      console.warn("[Firebase] Init note:", e.message);
      return false;
    }
  }
}

// Auto-initialize if key is present
initFirebase();

// Attempt silent fetch of local gitignored config if available
if (!isConnected && typeof window !== "undefined" && typeof fetch === "function") {
  fetch("/firebase-config.json")
    .then((r) => (r.ok ? r.json() : null))
    .then((cfg) => {
      if (cfg?.apiKey) {
        localStorage.setItem("mureza_firebase_api_key", cfg.apiKey);
        initFirebase(cfg.apiKey);
      }
    })
    .catch(() => {});
}

export function setFirebaseApiKey(key) {
  if (typeof window !== "undefined" && key) {
    localStorage.setItem("mureza_firebase_api_key", key.trim());
    return initFirebase(key.trim());
  }
  return false;
}

export function getIsConnected() {
  return isConnected && db !== null;
}

export { app, db, storage, isConnected };

// ============================================================
// DEFAULT SEED DATA (from MUREZA Supplier Deck & Portal Plan)
// ============================================================

export const DEFAULT_PAGE_CONTENT = {
  displayWord: "SUPPLIERS",
  kicker: "01 / STRATEGIC PARTNERS",
  headline: "BUILDING THE FUTURE.",
  tagline: "A sovereign supply chain for African mobility.",
  brandName: "SUPPLIER PORTAL",
  heroSubtitle: "OEM Supplier Development & Localization Program across Southern, Eastern and Western Africa.",
  overviewKicker: "02 / CONTINENTAL INDUSTRIALIZATION",
  overviewHeadline: "TRANSFORMING AFRICAN MOBILITY FROM THE GROUND UP.",
  overviewBody: "MUREZA is catalyzing a pan-African automotive component manufacturing ecosystem under the AfCFTA framework. We are onboarding 50 Tier 1, 2, 3, Technology, and Infrastructure partners to build localized electric and ICE commercial vehicles with up to 60% domestic African value addition.",
  pillars: [
    {
      code: "01",
      title: "OEM CATALYST",
      desc: "Guaranteed production volume and off-take contracts for certified African component fabricators across passenger and commercial vehicle platforms."
    },
    {
      code: "02",
      title: "SPECIAL ECONOMIC ZONES",
      desc: "Integrated industrial land with 20–60 MW dedicated power, port access, and bonded customs clearance in South Africa, Ethiopia, and Kenya."
    },
    {
      code: "03",
      title: "AfCFTA MARKET ACCESS",
      desc: "Direct access to a 1.3 billion-person unified market with zero-tariff component movement under local content rules of origin."
    },
    {
      code: "04",
      title: "HOMOLOGATION & NCAP",
      desc: "Comprehensive testing, CAD/CAE validation, and type-approval support aligned with SABS, KEBS, NAFDAC, and international NCAP safety standards."
    }
  ],
  stats: {
    totalPartners: "50",
    marketSize: "1.3B",
    localContentTarget: "60%",
    sezHubs: "3"
  },
  contactEmail: "suppliers@mave.africa",
  contactPhone: "+27 (0) 11 568 9300",
  // Qualification Fees & Payment Controls
  tierFeesEnabled: false, // Client does not want to charge yet; fees waived / free pilot onboarding
  feeWaivedLabel: "Fee Waived — AfCFTA Pilot Onboarding",
  stripeConfig: {
    enabled: false,
    publishableKey: "",
    testMode: true
  },
  resendConfig: {
    enabled: true,
    fromEmail: "MAVE <onboarding@mave.africa>",
    replyTo: "suppliers@mave.africa"
  },
  lastUpdated: new Date().toISOString()
};

export const DEFAULT_TIERS = [
  {
    id: "tier-1",
    code: "TIER 1",
    title: "TIER 1",
    sub: "MAJOR SYSTEMS",
    capacity: 12,
    filled: 3,
    feeAmount: 45000,
    feeCurrency: "ZAR",
    feeFormatted: "R 45,000",
    feeFrequency: "Once-off Qualification Fee",
    color: "#cf8f45",
    focus: [
      "Body stampings & outer panels",
      "Powertrain systems & EV traction drives",
      "Electrical architecture (ECU, harnesses)",
      "HVAC & interior cockpit modules",
      "Braking, suspension & steering assemblies"
    ],
    requirements: "ISO 9001 / IATF 16949 certification or readiness, OEM manufacturing capability, audited financials.",
    status: "Active"
  },
  {
    id: "tier-2",
    code: "TIER 2",
    title: "TIER 2",
    sub: "PROCESSING & SUB-ASSEMBLY",
    capacity: 10,
    filled: 2,
    feeAmount: 30000,
    feeCurrency: "ZAR",
    feeFormatted: "R 30,000",
    feeFrequency: "Once-off Qualification Fee",
    color: "#c29b68",
    focus: [
      "Steel & aluminium stamping / extrusion",
      "Thermoplastic injection moulding",
      "Rubber compounds, seals & weatherstrips",
      "Automotive safety glass & glazing",
      "Wiring sub-components, relays & sensors"
    ],
    requirements: "Quality management systems, production scale capacity, raw material traceability.",
    status: "Active"
  },
  {
    id: "tier-3",
    code: "TIER 3",
    title: "TIER 3",
    sub: "RAW MATERIALS",
    capacity: 10,
    filled: 4,
    feeAmount: 25000,
    feeCurrency: "ZAR",
    feeFormatted: "R 25,000",
    feeFrequency: "Once-off Qualification Fee",
    color: "#9a8873",
    focus: [
      "Battery-grade lithium & cathode precursors",
      "Refined copper rods & conductive alloys",
      "Automotive grade steel coil & aluminium ingots",
      "Rare earth permanent magnets (NdFeB)",
      "Recycled engineering plastics"
    ],
    requirements: "Mining/processing licenses, chemical analysis certificates, ESG compliance documentation.",
    status: "Active"
  },
  {
    id: "services",
    code: "SERVICES",
    title: "SERVICES",
    sub: "TECH & DESIGN",
    capacity: 10,
    filled: 3,
    feeAmount: 20000,
    feeCurrency: "ZAR",
    feeFormatted: "R 20,000",
    feeFrequency: "Once-off Qualification Fee",
    color: "#8fa89b",
    focus: [
      "Vehicle CAD/CAE modeling & simulation",
      "Tooling, jig & stamping die makers",
      "Robotics, automation & line integration",
      "Homologation, crash testing & EMC validation",
      "Embedded telematics & software engineering"
    ],
    requirements: "Demonstrated portfolio of automotive or high-precision engineering projects.",
    status: "Active"
  },
  {
    id: "infra",
    code: "INFRA",
    title: "INFRA.",
    sub: "SEZ & POWER",
    capacity: 8,
    filled: 2,
    feeAmount: 15000,
    feeCurrency: "ZAR",
    feeFormatted: "R 15,000",
    feeFrequency: "Once-off Qualification Fee",
    color: "#7a92a3",
    focus: [
      "Special Economic Zone industrial park sites",
      "Dedicated 20–60 MW industrial power substations",
      "Multimodal port, dry port & rail transit links",
      "Industrial water treatment & waste management",
      "Telecommunications & high-speed fiber backhaul"
    ],
    requirements: "Zoning approval, environmental impact authorization, utility supply contracts.",
    status: "Active"
  }
];

export const DEFAULT_TENDERS = [
  {
    id: "rfp-chassis-01",
    ref: "RFP-2026-CHASSIS-01",
    title: "Villager EV 800-Ton Monocoque Die Stamping & Floor Pan Tooling",
    category: "Body Shell & Chassis (Tier 1 & 2)",
    volume: "15,000 sets / year (3-Year Master Off-take)",
    localContentPct: 60,
    estimatedValue: "R 180,000,000 / $9.8M USD",
    location: "South Africa / East Africa SEZ Hubs",
    deadline: "2026-12-15",
    status: "open",
    scope: "Design, tooling fabrication, and progressive die stamping of monocoque structural floor rails, crossmembers, and high-strength cold-rolled steel stampings for the MUREZA Villager platform.",
    requirements: "IATF 16949 / ISO 9001 certified or audited readiness, minimum 60% African raw material value addition, CMM dimensional inspection capability.",
    bidsCount: 0,
    createdAt: new Date().toISOString()
  },
  {
    id: "rfp-harness-02",
    ref: "RFP-2026-HV-HARNESS-02",
    title: "High-Voltage 400V Powertrain Wire Harness & Integrated PDU Assemblies",
    category: "Electrical & Powertrain (Tier 1 & 2)",
    volume: "20,000 vehicle harness kits / year",
    localContentPct: 55,
    estimatedValue: "R 95,000,000 / $5.2M USD",
    location: "Kenya / Ethiopia SEZ Assembly Hubs",
    deadline: "2026-11-30",
    status: "open",
    scope: "Fabrication of shielded 400V orange traction wire harnesses, CAN-bus sub-harnesses, IP67 sealed connectors, and high-voltage power distribution units (PDU). Sourcing of Zambian or Congolese refined copper conductor.",
    requirements: "High-voltage automotive wire harness assembly experience, automated crimp pull-force testing, continuity test jigs.",
    bidsCount: 0,
    createdAt: new Date().toISOString()
  },
  {
    id: "rfp-cabin-03",
    ref: "RFP-2026-CABIN-TRIM-03",
    title: "Modular Commuter Passenger Seating & Thermoformed Dashboard Trim",
    category: "Cockpit & Interior Trim (Tier 2)",
    volume: "12,000 ship sets / year",
    localContentPct: 50,
    estimatedValue: "R 48,000,000 / $2.6M USD",
    location: "Southern African SEZ Logistics Center",
    deadline: "2027-01-20",
    status: "open",
    scope: "Lightweight modular passenger seating with heavy-duty automotive upholstery, tubular steel frames, ISOFIX child seat anchorage, and soft-touch injection-molded instrument cluster bezels.",
    requirements: "UN ECE R14 / R17 crash testing compliance documentation, fire-retardant fabric certification, domestic African recycled plastics blending.",
    bidsCount: 0,
    createdAt: new Date().toISOString()
  }
];

// ============================================================
// LOCAL STORAGE RESILIENCE HELPERS
// ============================================================

const STORAGE_KEYS = {
  CONTENT: "mureza_supplier_content_v2",
  TIERS: "mureza_supplier_tiers_v2",
  SUBMISSIONS: "mureza_supplier_submissions_v2",
  NOTIFICATIONS: "mureza_supplier_notifications_v2",
  TENDERS: "mureza_supplier_tenders_v2",
  BIDS: "mureza_supplier_bids_v2"
};

function readLocal(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function writeLocal(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.warn("localStorage write error", e);
  }
}

// ============================================================
// REACTIVE PUB-SUB EVENT BUS & REAL-TIME FIRESTORE BINDINGS
// ============================================================

const subscribers = {
  content: new Set(),
  tiers: new Set(),
  submissions: new Set(),
  notifications: new Set(),
  tenders: new Set(),
  bids: new Set()
};

const firestoreUnsubs = {
  content: null,
  tiers: null,
  submissions: null,
  notifications: null,
  tenders: null,
  bids: null
};

function emitSubscribers(type, data) {
  if (!subscribers[type]) return;
  subscribers[type].forEach((cb) => {
    try {
      cb(data);
    } catch (e) {
      console.warn(`[Subscriber callback error: ${type}]`, e);
    }
  });
}

function attachFirestoreListener(type) {
  if (!db || subscribers[type].size === 0 || firestoreUnsubs[type]) return;

  try {
    if (type === "content") {
      const contentDocRef = doc(db, "supplierPortal", "content");
      firestoreUnsubs.content = onSnapshot(
        contentDocRef,
        (snap) => {
          if (snap.exists()) {
            const data = { ...DEFAULT_PAGE_CONTENT, ...snap.data() };
            writeLocal(STORAGE_KEYS.CONTENT, data);
            emitSubscribers("content", data);
          } else {
            saveSiteContent(DEFAULT_PAGE_CONTENT).catch(() => {});
          }
        },
        (err) => console.warn("[Firebase] Content sync notice:", err.message)
      );
    } else if (type === "tiers") {
      const tiersColRef = collection(db, "supplierTiers");
      firestoreUnsubs.tiers = onSnapshot(
        tiersColRef,
        (snap) => {
          if (!snap.empty) {
            const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            writeLocal(STORAGE_KEYS.TIERS, list);
            emitSubscribers("tiers", list);
          } else {
            seedDefaultTiers().catch(() => {});
          }
        },
        (err) => console.warn("[Firebase] Tiers sync notice:", err.message)
      );
    } else if (type === "submissions") {
      const subsColRef = collection(db, "supplierSubmissions");
      firestoreUnsubs.submissions = onSnapshot(
        subsColRef,
        (snap) => {
          if (!snap.empty) {
            const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            list.sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));
            writeLocal(STORAGE_KEYS.SUBMISSIONS, list);
            emitSubscribers("submissions", list);
          }
        },
        (err) => console.warn("[Firebase] Submissions sync notice:", err.message)
      );
    } else if (type === "notifications") {
      const notifsColRef = collection(db, "supplierNotifications");
      firestoreUnsubs.notifications = onSnapshot(
        notifsColRef,
        (snap) => {
          if (!snap.empty) {
            const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
            writeLocal(STORAGE_KEYS.NOTIFICATIONS, list);
            emitSubscribers("notifications", list);
          }
        },
        (err) => console.warn("[Firebase] Notifications sync notice:", err.message)
      );
    }
  } catch (err) {
    console.warn(`[Firebase] Could not attach listener for ${type}:`, err.message);
  }
}

function attachAllFirestoreListeners() {
  if (!db) return;
  attachFirestoreListener("content");
  attachFirestoreListener("tiers");
  attachFirestoreListener("submissions");
  attachFirestoreListener("notifications");
}

// ============================================================
// 1. PAGE CONTENT API
// ============================================================

export function onSiteContentSnapshot(callback) {
  // 1. Immediately emit local cache / defaults for instant render
  const cached = readLocal(STORAGE_KEYS.CONTENT, DEFAULT_PAGE_CONTENT);
  callback(cached);

  subscribers.content.add(callback);
  attachFirestoreListener("content");

  return () => {
    subscribers.content.delete(callback);
    if (subscribers.content.size === 0 && firestoreUnsubs.content) {
      firestoreUnsubs.content();
      firestoreUnsubs.content = null;
    }
  };
}

export async function saveSiteContent(data) {
  const merged = { ...DEFAULT_PAGE_CONTENT, ...data, lastUpdated: new Date().toISOString() };
  writeLocal(STORAGE_KEYS.CONTENT, merged);
  emitSubscribers("content", merged);

  if (!db) return merged;

  try {
    const contentDocRef = doc(db, "supplierPortal", "content");
    await setDoc(contentDocRef, merged, { merge: true });
    console.log("[Firebase] Page content saved successfully to Firestore");
  } catch (err) {
    console.warn("[Firebase] Could not save content to Firestore, preserved locally:", err.message);
  }
  return merged;
}

// ============================================================
// 2. TIERS & PRICING API
// ============================================================

export function onTiersSnapshot(callback) {
  // Emit local cache immediately
  const cached = readLocal(STORAGE_KEYS.TIERS, DEFAULT_TIERS);
  callback(cached);

  subscribers.tiers.add(callback);
  attachFirestoreListener("tiers");

  return () => {
    subscribers.tiers.delete(callback);
    if (subscribers.tiers.size === 0 && firestoreUnsubs.tiers) {
      firestoreUnsubs.tiers();
      firestoreUnsubs.tiers = null;
    }
  };
}

export async function seedDefaultTiers() {
  writeLocal(STORAGE_KEYS.TIERS, DEFAULT_TIERS);
  emitSubscribers("tiers", DEFAULT_TIERS);

  if (!db) return;
  try {
    for (const tier of DEFAULT_TIERS) {
      await setDoc(doc(db, "supplierTiers", tier.id), tier, { merge: true });
    }
    console.log("[Firebase] Seeded default supplier tiers in Firestore");
  } catch (err) {
    console.warn("[Firebase] Seed default tiers note:", err.message);
  }
}

export async function saveTier(tierData) {
  const id = tierData.id || `tier_${Date.now()}`;
  const fullTier = { ...tierData, id };

  // Update local
  const current = readLocal(STORAGE_KEYS.TIERS, DEFAULT_TIERS);
  const idx = current.findIndex((t) => t.id === id);
  if (idx >= 0) current[idx] = fullTier;
  else current.push(fullTier);
  writeLocal(STORAGE_KEYS.TIERS, current);
  emitSubscribers("tiers", current);

  if (db) {
    try {
      await setDoc(doc(db, "supplierTiers", id), fullTier, { merge: true });
      console.log(`[Firebase] Saved tier ${id} to Firestore`);
    } catch (err) {
      console.warn("[Firebase] Error saving tier to Firestore, preserved locally:", err.message);
    }
  }
  return fullTier;
}

export async function deleteTier(id) {
  const current = readLocal(STORAGE_KEYS.TIERS, DEFAULT_TIERS).filter((t) => t.id !== id);
  writeLocal(STORAGE_KEYS.TIERS, current);
  emitSubscribers("tiers", current);

  if (db) {
    try {
      await deleteDoc(doc(db, "supplierTiers", id));
      console.log(`[Firebase] Deleted tier ${id}`);
    } catch (err) {
      console.warn("[Firebase] Error deleting tier:", err.message);
    }
  }
}

// ============================================================
// 3. DOCUMENT UPLOAD & STORAGE
// ============================================================

export async function uploadSupplierDocument(file, companyName = "general") {
  if (!file) throw new Error("No file provided");

  const sanitizedCompany = companyName.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 30);
  const ext = (file.name.split(".").pop() || "pdf").toLowerCase();
  const timestamp = Date.now();
  const safeFilename = `${sanitizedCompany}_${timestamp}.${ext}`;
  const path = `supplier-documents/${safeFilename}`;

  // If Firebase Storage is accessible:
  if (storage) {
    try {
      const sRef = storageRef(storage, path);
      const snapshot = await uploadBytes(sRef, file, {
        contentType: file.type || "application/octet-stream",
        customMetadata: {
          originalName: file.name,
          uploadedAt: new Date().toISOString(),
          company: companyName
        }
      });
      const downloadUrl = await getDownloadURL(snapshot.ref);
      return {
        name: file.name,
        size: file.size,
        type: file.type,
        storagePath: path,
        url: downloadUrl,
        uploadedAt: new Date().toISOString()
      };
    } catch (err) {
      console.warn("[Firebase Storage] Live upload skipped or restricted, falling back to data URL:", err.message);
    }
  }

  // Graceful fallback: Base64 data URL
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        name: file.name,
        size: file.size,
        type: file.type,
        storagePath: path,
        url: reader.result,
        uploadedAt: new Date().toISOString()
      });
    };
    reader.onerror = () => {
      resolve({
        name: file.name,
        size: file.size,
        type: file.type,
        storagePath: path,
        url: "#",
        uploadedAt: new Date().toISOString()
      });
    };
    reader.readAsDataURL(file);
  });
}

// ============================================================
// 4. SUPPLIER REGISTRATIONS & REVIEW PIPELINE
// ============================================================

export async function submitSupplierRegistration(formData, files = []) {
  const timestamp = Date.now();
  const rand = Math.floor(1000 + Math.random() * 9000);
  const trackingCode = `MVR-2026-${rand}`;

  // Process uploaded documents
  const documentList = [];
  for (const file of files) {
    try {
      const docRecord = await uploadSupplierDocument(file, formData.companyName || "applicant");
      documentList.push(docRecord);
    } catch (e) {
      console.warn("File upload notice:", e);
    }
  }

  const submission = {
    id: `app_${timestamp}_${rand}`,
    trackingCode,
    companyName: formData.companyName?.trim() || "Unnamed Company",
    registrationNumber: formData.registrationNumber?.trim() || "",
    country: formData.country || "South Africa",
    yearEstablished: formData.yearEstablished || new Date().getFullYear(),
    website: formData.website?.trim() || "",
    contactName: formData.contactName?.trim() || "",
    contactEmail: formData.contactEmail?.trim() || "",
    contactPhone: formData.contactPhone?.trim() || "",
    contactRole: formData.contactRole?.trim() || "",
    primaryCategory: formData.primaryCategory || "General Component Manufacturing",
    selectedTier: formData.selectedTier || "tier-1",
    assignedTier: formData.selectedTier || "tier-1",
    capabilitySummary: formData.capabilitySummary?.trim() || "",
    facilityLocation: formData.facilityLocation?.trim() || "",
    employeeCount: formData.employeeCount || "10-50",
    status: "pending", // 'pending' | 'under_review' | 'tier_assigned' | 'approved' | 'declined'
    reviewerNotes: "",
    documents: documentList,
    submittedAt: new Date().toISOString()
  };

  // 1. Save to local storage
  const current = readLocal(STORAGE_KEYS.SUBMISSIONS, []);
  current.unshift(submission);
  writeLocal(STORAGE_KEYS.SUBMISSIONS, current);
  emitSubscribers("submissions", current);

  // 2. Add local notification
  addNotification({
    title: "New Supplier Registration",
    message: `${submission.companyName} registered for ${submission.selectedTier.toUpperCase()}`,
    trackingCode: submission.trackingCode,
    submissionId: submission.id,
    type: "new_registration"
  });

  // 3. Save to Firestore if available
  if (db) {
    try {
      await setDoc(doc(db, "supplierSubmissions", submission.id), {
        ...submission,
        createdAt: serverTimestamp()
      });
      console.log("[Firebase] Supplier registration saved to Firestore:", submission.id);

      // Create Firestore notification
      await addDoc(collection(db, "supplierNotifications"), {
        title: "New Supplier Registration",
        message: `${submission.companyName} registered for ${submission.selectedTier.toUpperCase()}`,
        trackingCode: submission.trackingCode,
        submissionId: submission.id,
        type: "new_registration",
        read: false,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.warn("[Firebase] Could not write submission to Firestore, retained locally:", err.message);
    }
  }

  // 4. Trigger automated Resend email confirmation
  if (submission.contactEmail) {
    sendSupplierEmail({
      type: "registration_received",
      to: submission.contactEmail,
      companyName: submission.companyName,
      contactName: submission.contactName,
      trackingCode: submission.trackingCode,
      tierTitle: submission.selectedTier.toUpperCase()
    }).catch((e) => console.warn("Email dispatch notice:", e));
  }

  return submission;
}

export function onSubmissionsSnapshot(callback) {
  const cached = readLocal(STORAGE_KEYS.SUBMISSIONS, []);
  callback(cached);

  subscribers.submissions.add(callback);
  attachFirestoreListener("submissions");

  return () => {
    subscribers.submissions.delete(callback);
    if (subscribers.submissions.size === 0 && firestoreUnsubs.submissions) {
      firestoreUnsubs.submissions();
      firestoreUnsubs.submissions = null;
    }
  };
}

export async function updateSubmission(id, patch) {
  // Update local
  const current = readLocal(STORAGE_KEYS.SUBMISSIONS, []);
  const idx = current.findIndex((s) => s.id === id);
  if (idx >= 0) {
    current[idx] = { ...current[idx], ...patch, updatedAt: new Date().toISOString() };
    writeLocal(STORAGE_KEYS.SUBMISSIONS, current);
    emitSubscribers("submissions", current);
  }

  // Trigger status update email if contact email is present
  if (current[idx]?.contactEmail && (patch.status || patch.assignedTier || patch.reviewerNotes)) {
    sendSupplierEmail({
      type: "status_update",
      to: current[idx].contactEmail,
      companyName: current[idx].companyName,
      contactName: current[idx].contactName,
      trackingCode: current[idx].trackingCode,
      tierTitle: (patch.assignedTier || current[idx].assignedTier || "").toUpperCase(),
      status: patch.status || current[idx].status,
      reviewerNotes: patch.reviewerNotes || ""
    }).catch((e) => console.warn("Email status update notice:", e));
  }

  // Update Firestore
  if (db) {
    try {
      await updateDoc(doc(db, "supplierSubmissions", id), {
        ...patch,
        updatedAt: serverTimestamp()
      });
      console.log(`[Firebase] Updated submission ${id} with:`, patch);
    } catch (err) {
      console.warn("[Firebase] Update submission notice:", err.message);
    }
  }

  return current[idx] || null;
}

// ============================================================
// 5. NOTIFICATIONS SYSTEM
// ============================================================

export function addNotification(notification) {
  const n = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    title: notification.title,
    message: notification.message,
    trackingCode: notification.trackingCode || "",
    submissionId: notification.submissionId || "",
    type: notification.type || "info",
    read: false,
    createdAt: new Date().toISOString()
  };

  const current = readLocal(STORAGE_KEYS.NOTIFICATIONS, []);
  current.unshift(n);
  writeLocal(STORAGE_KEYS.NOTIFICATIONS, current.slice(0, 50));
  emitSubscribers("notifications", current);
  return n;
}

export function onNotificationsSnapshot(callback) {
  const cached = readLocal(STORAGE_KEYS.NOTIFICATIONS, []);
  callback(cached);

  subscribers.notifications.add(callback);
  attachFirestoreListener("notifications");

  return () => {
    subscribers.notifications.delete(callback);
    if (subscribers.notifications.size === 0 && firestoreUnsubs.notifications) {
      firestoreUnsubs.notifications();
      firestoreUnsubs.notifications = null;
    }
  };
}

export async function markNotificationRead(id) {
  const current = readLocal(STORAGE_KEYS.NOTIFICATIONS, []);
  const idx = current.findIndex((n) => n.id === id);
  if (idx >= 0) {
    current[idx].read = true;
    writeLocal(STORAGE_KEYS.NOTIFICATIONS, current);
    emitSubscribers("notifications", current);
  }

  if (db) {
    try {
      await updateDoc(doc(db, "supplierNotifications", id), { read: true });
    } catch (e) {
      // Non-critical
    }
  }
}

// ============================================================
// 6. RESEND EMAIL DISPATCH API
// ============================================================

export async function sendSupplierEmail(payload) {
  try {
    const res = await fetch("/api/send-supplier-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    console.log("[Email Service] Dispatched:", data);
    return data;
  } catch (err) {
    console.warn("[Email Service] Notice:", err.message);
    return { success: false, error: err.message };
  }
}

// ============================================================
// 7. ADMIN AUTHENTICATION HELPERS (FIREBASE AUTH)
// ============================================================

export async function loginAdmin(email, password) {
  if (!auth) {
    // If running offline or without credentials, allow dev session
    const devAdmin = { email, displayName: "MUREZA Procurement Lead", uid: "dev-admin-" + Date.now() };
    localStorage.setItem("mureza_cms_admin_session", JSON.stringify(devAdmin));
    return devAdmin;
  }
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  const adminObj = { email: cred.user.email, uid: cred.user.uid };
  localStorage.setItem("mureza_cms_admin_session", JSON.stringify(adminObj));
  return cred.user;
}

export async function logoutAdmin() {
  localStorage.removeItem("mureza_cms_admin_session");
  if (auth) {
    try {
      await signOut(auth);
    } catch (e) {}
  }
  return true;
}

export function getCurrentAdminUser() {
  if (auth?.currentUser) return auth.currentUser;
  try {
    const raw = localStorage.getItem("mureza_cms_admin_session");
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function onAdminAuthChanged(callback) {
  // Check local session first
  const cached = getCurrentAdminUser();
  if (cached) callback(cached);

  if (auth) {
    return onAuthStateChanged(auth, (user) => {
      if (user) {
        localStorage.setItem("mureza_cms_admin_session", JSON.stringify({ email: user.email, uid: user.uid }));
        callback(user);
      } else {
        localStorage.removeItem("mureza_cms_admin_session");
        callback(null);
      }
    });
  }
  return () => {};
}

// ============================================================
// 8. OEM TENDERS & BIDDING (RFP) API
// ============================================================

export function onTendersSnapshot(callback) {
  subscribers.tenders.add(callback);
  const current = readLocal(STORAGE_KEYS.TENDERS, DEFAULT_TENDERS);
  callback(current);

  if (db && !firestoreUnsubs.tenders) {
    try {
      const q = collection(db, "supplierTenders");
      firestoreUnsubs.tenders = onSnapshot(
        q,
        (snap) => {
          if (!snap.empty) {
            const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            writeLocal(STORAGE_KEYS.TENDERS, list);
            emitSubscribers("tenders", list);
          }
        },
        (err) => console.warn("[Firestore] Tenders subscription notice:", err.message)
      );
    } catch (e) {
      console.warn("Firestore tenders listen skipped:", e);
    }
  }

  return () => {
    subscribers.tenders.delete(callback);
    if (subscribers.tenders.size === 0 && firestoreUnsubs.tenders) {
      firestoreUnsubs.tenders();
      firestoreUnsubs.tenders = null;
    }
  };
}

export function onBidsSnapshot(callback) {
  subscribers.bids.add(callback);
  const current = readLocal(STORAGE_KEYS.BIDS, []);
  callback(current);

  if (db && !firestoreUnsubs.bids) {
    try {
      const q = collection(db, "supplierBids");
      firestoreUnsubs.bids = onSnapshot(
        q,
        (snap) => {
          if (!snap.empty) {
            const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            writeLocal(STORAGE_KEYS.BIDS, list);
            emitSubscribers("bids", list);
          }
        },
        (err) => console.warn("[Firestore] Bids subscription notice:", err.message)
      );
    } catch (e) {
      console.warn("Firestore bids listen skipped:", e);
    }
  }

  return () => {
    subscribers.bids.delete(callback);
    if (subscribers.bids.size === 0 && firestoreUnsubs.bids) {
      firestoreUnsubs.bids();
      firestoreUnsubs.bids = null;
    }
  };
}

export async function seedDefaultTenders() {
  writeLocal(STORAGE_KEYS.TENDERS, DEFAULT_TENDERS);
  emitSubscribers("tenders", DEFAULT_TENDERS);

  if (!db) return;
  try {
    for (const tender of DEFAULT_TENDERS) {
      await setDoc(doc(db, "supplierTenders", tender.id), tender, { merge: true });
    }
  } catch (err) {
    console.warn("[Firebase] Seed tenders note:", err.message);
  }
}

export async function saveTender(tenderData) {
  const id = tenderData.id || `rfp_${Date.now()}`;
  const fullTender = {
    ...tenderData,
    id,
    updatedAt: new Date().toISOString()
  };

  const current = readLocal(STORAGE_KEYS.TENDERS, DEFAULT_TENDERS);
  const idx = current.findIndex((t) => t.id === id);
  if (idx >= 0) current[idx] = fullTender;
  else current.unshift(fullTender);

  writeLocal(STORAGE_KEYS.TENDERS, current);
  emitSubscribers("tenders", current);

  if (db) {
    try {
      await setDoc(doc(db, "supplierTenders", id), fullTender, { merge: true });
    } catch (err) {
      console.warn("[Firebase] Error saving tender to Firestore:", err.message);
    }
  }
  return fullTender;
}

export async function deleteTender(id) {
  const current = readLocal(STORAGE_KEYS.TENDERS, DEFAULT_TENDERS).filter((t) => t.id !== id);
  writeLocal(STORAGE_KEYS.TENDERS, current);
  emitSubscribers("tenders", current);

  if (db) {
    try {
      await deleteDoc(doc(db, "supplierTenders", id));
    } catch (err) {
      console.warn("[Firebase] Error deleting tender:", err.message);
    }
  }
}

export async function submitTenderBid(bidData, proposalFile = null) {
  const timestamp = Date.now();
  const rand = Math.floor(1000 + Math.random() * 9000);
  const bidRef = `BID-2026-${rand}`;

  let proposalDoc = null;
  if (proposalFile) {
    try {
      proposalDoc = await uploadSupplierDocument(proposalFile, bidData.companyName || "bidder");
    } catch (e) {
      console.warn("Proposal upload notice:", e);
    }
  }

  const fullBid = {
    id: `bid_${timestamp}_${rand}`,
    bidRef,
    tenderId: bidData.tenderId,
    tenderRef: bidData.tenderRef,
    tenderTitle: bidData.tenderTitle,
    supplierTrackingCode: bidData.supplierTrackingCode || "",
    companyName: bidData.companyName?.trim() || "Supplier Applicant",
    contactName: bidData.contactName?.trim() || "",
    contactEmail: bidData.contactEmail?.trim() || "",
    contactPhone: bidData.contactPhone?.trim() || "",
    proposedUnitCost: Number(bidData.proposedUnitCost) || 0,
    currency: bidData.currency || "ZAR",
    toolingCost: Number(bidData.toolingCost) || 0,
    leadTimeWeeks: Number(bidData.leadTimeWeeks) || 12,
    localContentPct: Number(bidData.localContentPct) || 50,
    technicalNotes: bidData.technicalNotes?.trim() || "",
    proposalDoc,
    status: "submitted",
    reviewerNotes: "",
    submittedAt: new Date().toISOString()
  };

  const bids = readLocal(STORAGE_KEYS.BIDS, []);
  bids.unshift(fullBid);
  writeLocal(STORAGE_KEYS.BIDS, bids);
  emitSubscribers("bids", bids);

  const tenders = readLocal(STORAGE_KEYS.TENDERS, DEFAULT_TENDERS);
  const tIdx = tenders.findIndex((t) => t.id === fullBid.tenderId);
  if (tIdx >= 0) {
    tenders[tIdx].bidsCount = (tenders[tIdx].bidsCount || 0) + 1;
    writeLocal(STORAGE_KEYS.TENDERS, tenders);
    emitSubscribers("tenders", tenders);
  }

  addNotification({
    title: "New Tender Bid Submitted",
    message: `${fullBid.companyName} submitted proposal for ${fullBid.tenderRef}`,
    trackingCode: fullBid.bidRef,
    type: "tender_bid"
  });

  if (db) {
    try {
      await setDoc(doc(db, "supplierBids", fullBid.id), {
        ...fullBid,
        createdAt: serverTimestamp()
      });
      if (tIdx >= 0) {
        await updateDoc(doc(db, "supplierTenders", fullBid.tenderId), {
          bidsCount: tenders[tIdx].bidsCount
        });
      }
    } catch (err) {
      console.warn("[Firebase] Could not save bid to Firestore, saved locally:", err.message);
    }
  }

  if (fullBid.contactEmail) {
    sendSupplierEmail({
      type: "tender_bid_received",
      to: fullBid.contactEmail,
      companyName: fullBid.companyName,
      contactName: fullBid.contactName,
      trackingCode: fullBid.bidRef,
      tierTitle: fullBid.tenderTitle,
      reviewerNotes: `Your tender proposal for ${fullBid.tenderRef} (${fullBid.tenderTitle}) has been submitted to the MUREZA OEM Procurement Committee.`
    }).catch((e) => console.warn("Email dispatch notice:", e));
  }

  return fullBid;
}

export async function updateBidStatus(bidId, status, notes = "") {
  const bids = readLocal(STORAGE_KEYS.BIDS, []);
  const idx = bids.findIndex((b) => b.id === bidId);
  if (idx < 0) return null;

  bids[idx].status = status;
  bids[idx].reviewerNotes = notes;
  bids[idx].updatedAt = new Date().toISOString();

  writeLocal(STORAGE_KEYS.BIDS, bids);
  emitSubscribers("bids", bids);

  if (db) {
    try {
      await updateDoc(doc(db, "supplierBids", bidId), {
        status,
        reviewerNotes: notes,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.warn("[Firebase] Error updating bid status in Firestore:", err.message);
    }
  }

  if (bids[idx].contactEmail && (status === "awarded" || status === "shortlisted")) {
    sendSupplierEmail({
      type: "tender_award",
      to: bids[idx].contactEmail,
      companyName: bids[idx].companyName,
      contactName: bids[idx].contactName,
      trackingCode: bids[idx].bidRef,
      tierTitle: bids[idx].tenderTitle,
      status: status.toUpperCase(),
      reviewerNotes: notes || `Your bid for ${bids[idx].tenderRef} has been ${status.toUpperCase()} by the MUREZA Procurement Committee.`
    }).catch((e) => console.warn("Email dispatch notice:", e));
  }

  return bids[idx];
}

