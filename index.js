const TelegramBot = require("node-telegram-bot-api");

const fetch = require("node-fetch");

const TOKEN = "8612284358:AAEr-KFWbOthnaLUaFbFu33Q40Ri8zAh-kw";
const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxlp0r5CIGr5ibnU-KJabOho-K07n34VwuOWP9vdJT3SHQjfiJPU9ASjBEqgsLMpL6o/exec";

const bot = new TelegramBot(TOKEN, { polling: true });

const userState = {};

// списки
const PROVIDERS = [
  "Phoebus",
  "Zocket",
  "CN HM",
  "LV",
  "CZ",
  "CN BE",
  "CN AT",  
  "CS",
  "CN UL",
  "HK",
];
const PLATFORMS = [
  "Facebook",
  "TikTok",
  "Google Ads",
  "Taboola",
  "Telegram",
  "Bing",
  "Outbrain",
  "Twitter",
  "Snapchat",

];

// --- API ---
async function saveToSheet(data) {
  await fetch(SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

async function getActiveTasks() {
  const res = await fetch(SCRIPT_URL);
  return await res.json();
}

// --- UI ---
function sendMainMenu(chatId) {
  bot.sendMessage(chatId, "Обери дію:", {
    reply_markup: {
      keyboard: [["➕ Додати запит"], ["📋 Active"]],
      resize_keyboard: true,
    },
  });
}

// --- START ---
bot.onText(/\/start/, (msg) => {
  sendMainMenu(msg.chat.id);
});

// --- ACTIVE ---
async function sendActive(chatId) {
  const tasks = await getActiveTasks();

  if (!tasks.length) {
    bot.sendMessage(chatId, "✅ Немає активних задач");
    return;
  }

  let message = "⚠️ Active tasks:\n\n";

  tasks.forEach((t, i) => {
    message += `${i + 1}) ${t.client} | ${t.account}
Amount: ${t.amount || "-"}
Request Type: ${t.type}
Provider: ${t.provider}\n\n`;
  });

  bot.sendMessage(chatId, message);
}

// --- HANDLER ---
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!text) return;

  // 📋 Active
  if (text === "📋 Active") {
    await sendActive(chatId);
    return;
  }

  // ➕ Start flow
  if (text === "➕ Додати запит") {
    userState[chatId] = { step: "type" };

    bot.sendMessage(chatId, "Оберіть тип запиту:", {
      reply_markup: {
        keyboard: [["Top Up", "Refund"]],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    });

    return;
  }

  const state = userState[chatId];
  if (!state) return;

  // TYPE
  if (state.step === "type") {
    if (text !== "Top Up" && text !== "Refund") {
      bot.sendMessage(chatId, "Оберіть варіант з кнопок");
      return;
    }

    state.type = text;
    state.step = "client";
    bot.sendMessage(chatId, "Client?");
    return;
  }

  // CLIENT
  if (state.step === "client") {
    state.client = text;
    state.step = "platform";

    bot.sendMessage(chatId, "Оберіть платформу:", {
      reply_markup: {
        keyboard: PLATFORMS.map((p) => [p]),
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    });

    return;
  }

  // PLATFORM
  if (state.step === "platform") {
    if (!PLATFORMS.includes(text)) {
      bot.sendMessage(chatId, "Оберіть платформу:", {
        reply_markup: {
          keyboard: PLATFORMS.map((p) => [p]),
          resize_keyboard: true,
        },
      });
      return;
    }

    state.platform = text;
    state.step = "account";
    bot.sendMessage(chatId, "Account ID?");
    return;
  }

  // ACCOUNT
  if (state.step === "account") {
    state.account = text;

    if (state.type === "Refund") {
      state.amount = "-";
      state.step = "provider";
    } else {
      state.step = "amount";
      bot.sendMessage(chatId, "Amount?");
      return;
    }
  }

  // AMOUNT
  if (state.step === "amount") {
    state.amount = text;
    state.step = "provider";
  }

  // PROVIDER
  if (state.step === "provider") {
    if (!PROVIDERS.includes(text)) {
      bot.sendMessage(chatId, "Оберіть провайдера:", {
        reply_markup: {
          keyboard: PROVIDERS.map((p) => [p]),
          resize_keyboard: true,
        },
      });
      return;
    }

    state.provider = text;
    state.step = "confirm";

    const summary = `Перевір дані:

Type: ${state.type}
Client: ${state.client}
Platform: ${state.platform}
Account: ${state.account}
Amount: ${state.amount}
Provider: ${state.provider}`;

    bot.sendMessage(chatId, summary, {
      reply_markup: {
        keyboard: [["✅ Підтвердити", "❌ Скасувати"]],
        resize_keyboard: true,
      },
    });

    return;
  }

  // CONFIRM
  if (state.step === "confirm") {
    if (text === "❌ Скасувати") {
      delete userState[chatId];
      bot.sendMessage(chatId, "❌ Скасовано");
      sendMainMenu(chatId);
      return;
    }

    if (text === "✅ Підтвердити") {
      await saveToSheet(state);

      bot.sendMessage(chatId, "✅ Запит створено");

      delete userState[chatId];

      sendMainMenu(chatId);
      return;
    }

    bot.sendMessage(chatId, "Оберіть кнопку");
    return;
  }
});
