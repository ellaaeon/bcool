// netlify/functions/chat.js

function normalizeWarayVariants(text) {
  let t = text;

  const variants = {
    // greetings
    "maupay": ["maopay", "maupai", "mawpay", "mau pai", "maupay"],
    "kumusta": ["kumsta", "kamusta", "kumusta ka", "kumusta ka?"],

    // booking / action
    "pa schedule": ["pa sked", "pa sched", "pa isked", "pa iskedyul", "pa isched", "pa schedule", "paschedule"],
    "pa check": ["pa chek", "pa tsek", "pa tsik", "pa checkup", "pacheckup"],
    "booking": ["book", "booking", "magbook", "pa book", "pabook"],

    // problems
    "diri": ["di", "dri", "dire", "diri"],
    "diri nabugnaw": [
      "di nabugnaw",
      "dire nabugnaw",
      "waray bugnaw",
      "di na bugnaw",
      "diri na bugnaw",
      "dire na bugnaw",
      "not cold",
      "no cool"
    ],
    "tagas": ["may tulo", "nagtutulo", "may tagas", "tagas"],

    // services
    "cleaning": ["linis", "hugas", "hugasan", "limpyo", "pm", "preventive maintenance"],
    "gas": ["freon", "refrigerant", "refill", "top up"],
    "install": ["kabit", "ikabit", "itaod", "taod", "setup"],
    "uninstall": ["ibot", "kuha", "tanggal", "remove"],
    "washing machine": ["lavadora", "panglaba", "washing", "washer"],
    "refrigerator": ["pridyider", "ref", "fridge"]
  };

  for (const base of Object.keys(variants)) {
    for (const v of variants[base]) {
      const re = new RegExp(`\\b${escapeRegExp(v)}\\b`, "gi");
      t = t.replace(re, base);
    }
  }

  return t;
}

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeText(s) {
  let t = (s || "")
    .toLowerCase()
    .replace(/[\u2019\u2018]/g, "'")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  t = normalizeWarayVariants(t);
  return t;
}

function hasAny(text, words) {
  return words.some((w) => text.includes(w));
}

function makeWhatsAppUrl({ name, location, service, issue, datetime }) {
  const msg =
`Hi B-Cool! Pa-book po ako.

Name: ${name}
Location/Barangay: ${location}
Service: ${service}
Problem/Details: ${issue}
Preferred Date & Time: ${datetime}

Sent via website chat.`;

  return `https://wa.me/639812278970?text=${encodeURIComponent(msg)}`;
}

function getBotResponse(state, rawMessage) {
  const message = normalizeText(rawMessage);

  const CONTACT = "0981-227-8970";
  const KW = {
    greeting: ["hi", "hello", "hey", "hoy", "uy", "maupay", "kumusta"],
    price: ["price", "how much", "hm", "pila", "tagpila", "presyo", "rate", "bayad", "charge"],
    schedule: ["pa schedule", "booking", "appointment", "schedule", "pa check"],
    location: ["where", "asa", "hain", "diin", "location", "address", "barugo", "leyte", "area", "nearby"],
    hours: ["open", "close", "hours", "oras", "avail", "available"],
    ac_repair: ["ac repair", "repair", "guba", "diri nabugnaw", "error"],
    cleaning: ["cleaning"],
    gas: ["gas"],
    install: ["install"],
    uninstall: ["uninstall"],
    ref: ["refrigerator"],
    wash: ["washing machine"],
    freecheck: ["free", "free check", "free check up", "free checkup", "libre", "wara bayad"]
  };

  // ---- Booking flow (server-side state machine) ----
  if (state.bookingMode) {
    // Step 1: name
    if (state.step === 1) {
      state.data.name = rawMessage.trim();
      state.step = 2;
      return {
        reply: "2/5: Hain ka? (Barangay/Area, Barugo or nearby)",
        state
      };
    }

    // Step 2: location
    if (state.step === 2) {
      state.data.location = rawMessage.trim();
      state.step = 3;
      return {
        reply: "3/5: Ano nga serbisyo? (AC repair / cleaning PM / gas freon / install / ref / washing machine)",
        state
      };
    }

    // Step 3: service
    if (state.step === 3) {
      state.data.service = rawMessage.trim();
      state.step = 4;
      return {
        reply: "4/5: Ano an problema? (e.g. diri nabugnaw, may tagas, error code, etc.)",
        state
      };
    }

    // Step 4: issue
    if (state.step === 4) {
      state.data.issue = rawMessage.trim();
      state.step = 5;
      return {
        reply: "5/5: Preferred date & time? (example: tomorrow 2pm / Jan 29 9am)",
        state
      };
    }

    // Step 5: datetime -> finish
    if (state.step === 5) {
      state.data.datetime = rawMessage.trim();

      const waUrl = makeWhatsAppUrl(state.data);

      // reset booking mode after completing
      const nextState = {
        bookingMode: false,
        step: 0,
        data: { name: "", location: "", service: "", issue: "", datetime: "" }
      };

      return {
        reply: "Salamat! ✅ Opening WhatsApp para ma-send dayon an booking details.",
        action: "open_whatsapp",
        whatsapp_url: waUrl,
        state: nextState
      };
    }
  }

  // ---- Start booking when user asks ----
  if (hasAny(message, KW.schedule)) {
    return {
      reply: "Sige ✅ pa-schedule ta. (Booking)\n1/5: Ano an imo **pangaran**?",
      state: {
        bookingMode: true,
        step: 1,
        data: { name: "", location: "", service: "", issue: "", datetime: "" }
      }
    };
  }

  // ---- FAQ responses ----
  if (hasAny(message, KW.greeting)) {
    return {
      reply:
        "Maupay! 👋 Ako an B-Cool assistant.\n" +
        "Pwede ka magyakan: “ac repair”, “cleaning/pm”, “gas/freon”, “install”, “pila presyo”, o “pa schedule”.",
      state
    };
  }

  if (hasAny(message, KW.location)) {
    return {
      reply: "📍 Barugo, Leyte kami. Nagse-serve kami ha Barugo ngan harani nga communities. Ano an imo barangay/area?",
      state
    };
  }

  if (hasAny(message, KW.hours)) {
    return {
      reply: "Available kami para service pinaagi hin booking. ✅ Ibutang la an imo lugar + preferred oras para ma-schedule ta.",
      state
    };
  }

  if (hasAny(message, KW.freecheck)) {
    return {
      reply: "Yes ✅ may **FREE check-up** kami para service inquiries. Gusto mo magpa-schedule? Type “pa schedule”.",
      state
    };
  }

  if (hasAny(message, KW.price)) {
    return {
      reply:
        "Ha presyo: nagde-depende ito ha unit type ngan issue.\n" +
        "✅ May **FREE check-up** kami para sakto nga estimate.\n" +
        "I-send: unit type (split/window) + problema + lugar.",
      state
    };
  }

  if (hasAny(message, KW.ac_repair)) {
    return { reply: "✅ AC repair. Ano an symptoms? (diri nabugnaw / tagas / error / diri naga andar). Type “pa schedule” para booking.", state };
  }

  if (hasAny(message, KW.cleaning)) {
    return { reply: "✅ Cleaning/PM. Maupay ini para magdugay an unit. Type “pa schedule” para booking.", state };
  }

  if (hasAny(message, KW.gas)) {
    return { reply: "✅ Gas/Freon. Ginche-check namon anay kon may leak/tagas antes refill. Type “pa schedule” para booking.", state };
  }

  if (hasAny(message, KW.install)) {
    return { reply: "✅ Installation. I-send unit type + location. Type “pa schedule” para booking.", state };
  }

  if (hasAny(message, KW.uninstall)) {
    return { reply: "✅ Uninstallation/removal. I-send unit type + location + kun ibabalhin. Type “pa schedule” para booking.", state };
  }

  if (hasAny(message, KW.ref)) {
    return { reply: "✅ Refrigerator repair. Ano an issue? (diri nabugnaw / saba / waray andar). Type “pa schedule” para booking.", state };
  }

  if (hasAny(message, KW.wash)) {
    return { reply: "✅ Washing machine repair. Ano an issue? (diri mag-spin / diri mag-drain / tagas). Type “pa schedule” para booking.", state };
  }

  return {
    reply:
      "Pasensya, diri ko fully nasabtan. 😅\n" +
      "Pwede ka mamili: “ac repair”, “cleaning/pm”, “gas/freon”, “install”, “ref repair”, “washing machine”, “pila presyo”, “pa schedule”.\n" +
      `Or tawag diretso: 📞 ${CONTACT}`,
    state
  };
}

exports.handler = async (event) => {
  // Allow POST only
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const message = body.message;
    const clientState = body.state || {
      bookingMode: false,
      step: 0,
      data: { name: "", location: "", service: "", issue: "", datetime: "" }
    };

    if (!message || typeof message !== "string") {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Message required" })
      };
    }

    // FREE bot response (no OpenAI)
    const out = getBotResponse(clientState, message);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(out)
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Server error", details: String(e) })
    };
  }
};
