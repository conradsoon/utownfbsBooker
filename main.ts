import puppeteer, { Frame, Page } from "puppeteer";
import { Context } from "telegraf";
const { Telegraf, Scenes, session } = require("telegraf");
import config from "config";

const selectByText = async (
  context: Page | Frame,
  selector: string,
  text: string
) => {
  console.log(`Looking for select element with selector "${selector}"...`);

  const selectElement = await context.$(selector);
  if (!selectElement) {
    console.error(`No select element found with selector "${selector}"`);
    return;
  }

  console.log(`Select element found. Looking for options...`);
  const options = await context.$$(selector + " > option");
  console.log(`Found ${options.length} options.`);

  for (let option of options) {
    let optionText = await context.evaluate(
      (element) => element.textContent,
      option
    );

    if (optionText!.trim() === text) {
      console.log(
        `Found option with matching text: "${optionText}". Selecting...`
      );
      let optionValue = await context.evaluate(
        (element) => (element as HTMLOptionElement).value,
        option
      );

      console.log(`Option value to select: "${optionValue}".`);

      // This script sets the value and dispatches the events
      await context.evaluate(
        ({ selector, optionValue }) => {
          const select = document.querySelector(selector) as HTMLSelectElement;
          select.value = optionValue;

          console.log(`Option value after setting: "${select.value}".`);

          // Dispatch events
          select.dispatchEvent(new Event("change", { bubbles: true }));
          select.dispatchEvent(new Event("input", { bubbles: true }));

          console.log(
            `Option value after dispatching events: "${select.value}".`
          );
        },
        { selector, optionValue }
      );

      console.log(`Option selected. Waiting for postback to finish...`);

      // Wait for postback to finish

      console.log(`Postback finished.`);
      break;
    }
  }
};

const bookSlot = async (
  date: string,
  startTime: string,
  endTime: string,
  expectedAttendees: string,
  usageType: string,
  chargeGroup: string,
  purpose: string
): Promise<void> => {
  let browser;
  try {
    browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    // const username = process.env.UTOWNFBS_USER;
    // const password = process.env.UTOWNFBS_PASS;
    const username = config.get<string>("utownfbs.user");
    const password = config.get<string>("utownfbs.pass");

    if (!username || !password) {
      throw new Error(
        "Username or password is not set in environment variables"
      );
    }

    await page.authenticate({ username, password });
    await Promise.all([
      page.goto("https://utownfbs.nus.edu.sg/utown/apptop.aspx"),
      page.waitForNavigation({ waitUntil: "networkidle0" }),
    ]);

    const frames = await page.frames();
    const targetFrame = frames.find(
      (frame) =>
        frame.url() ===
        "https://utownfbs.nus.edu.sg/utown/modules/booking/search.aspx"
    );

    if (!targetFrame) {
      throw new Error("Target frame not found");
    }

    await targetFrame.waitForSelector('select[name="FacilityType$ctl02"]', {
      timeout: 5000,
    });
    await selectByText(
      targetFrame,
      'select[name="FacilityType$ctl02"]',
      "(Seminar Room) - Facilities at Residential College 4"
    );
    await targetFrame.waitForTimeout(500);

    await selectByText(
      targetFrame,
      'select[name="Facility$ctl02"]',
      "RC4 ORCA HUB (B1-45) (20 pax) (Residential College 4)"
    );
    await targetFrame.waitForTimeout(500);

    await targetFrame.evaluate((date) => {
      const startDateField = document.getElementById(
        "StartDate_ctl03"
      ) as HTMLInputElement;
      startDateField!.value = date;
    }, date);

    await targetFrame.evaluate((date) => {
      const startDateField = document.getElementById(
        "StartDate_ctl10"
      ) as HTMLInputElement;
      startDateField!.value = date;
    }, date);

    await targetFrame.click("input#btnViewAvailability");
    await targetFrame.waitForTimeout(2000);
    const divAvailable = await targetFrame.$(".divAvailable");

    if (!divAvailable) {
      throw new Error("No available slots found");
    }

    await divAvailable.click();
    await targetFrame.waitForTimeout(10000);
    const iframeElement = await targetFrame.$("#frmCreate");

    if (!iframeElement) {
      throw new Error("Iframe for booking creation not found");
    }

    const newFrame = await iframeElement.contentFrame();

    if (!newFrame) {
      throw new Error("Content frame not found in iframe");
    }

    await selectByText(newFrame, 'select[name="from$ctl02"]', startTime);
    await newFrame.waitForTimeout(500);
    await selectByText(newFrame, 'select[name="to$ctl02"]', endTime);
    await newFrame.waitForTimeout(500);
    await newFrame.type(
      'input[name="ExpectedNoAttendees$ctl02"]',
      expectedAttendees
    );
    await newFrame.waitForTimeout(500);
    await selectByText(newFrame, 'select[name="UsageType$ctl02"]', usageType);
    await newFrame.waitForTimeout(500);
    await selectByText(
      newFrame,
      'select[name="ChargeGroup$ctl02"]',
      chargeGroup
    );
    await newFrame.waitForTimeout(500);
    await newFrame.type('textarea[name="Purpose$ctl02"]', purpose);
    await newFrame.waitForTimeout(500);

    await newFrame.click("#btnCreateBooking");
    await newFrame!.waitForTimeout(10000);

    // You can now check for the existence of the error message or proceed with the next steps
    const errorMessageElement = await newFrame!.$("#labelMessage1");
    if (errorMessageElement) {
      const errorMessage = await newFrame!.$eval(
        "#labelMessage1",
        (el) => el.textContent
      );
      throw new Error(
        errorMessage ? errorMessage : "Booking failed (null message)"
      );
    }

    console.log("Booking has been made successfully");
  } catch (error) {
    console.error("Booking failed", error);
    throw error;
  } finally {
    if (browser) await browser.close();
  }
};

// const bot = new Telegraf(process.env.BOT_TOKEN);
const bot = new Telegraf(config.get<string>("telegram.botToken"));

bot.start((ctx: Context) =>
  ctx.reply(
    "Welcome! To make a booking, use the /book command followed by the booking details."
  )
);

// @ts-ignore
bot.command("bookgym", async (ctx) => {
  if (!("text" in ctx.message)) {
    return ctx.reply("This command can only be used with text messages. 😅");
  }

  const regex =
    /\/book (\d{2}-[a-zA-Z]{3}-\d{4}) (\d{2}:\d{2}) (\d{2}:\d{2}) "(.+)"/;
  const parts = ctx.message.text.match(regex);

  if (!parts || parts.length < 5) {
    return ctx.reply(
      'Please provide all booking details in the correct format. Usage: /bookgym <date> <start time> <end time> "<purpose>"'
    );
  }

  const [, date, startTime, endTime, purpose] = parts;

  const bookingMessage = await ctx.reply("Booking in progress... ⏳", {
    reply_to_message_id: ctx.message.message_id,
  });

  let seconds = 0;
  let dotCount = 1;
  const intervalId = setInterval(async () => {
    seconds += 1;
    const dots = ".".repeat(dotCount);
    dotCount = (dotCount % 3) + 1;
    await ctx.telegram.editMessageText(
      bookingMessage.chat.id,
      bookingMessage.message_id,
      undefined,
      `Booking in progress${dots} (${seconds} seconds elapsed) ⏳`,
      { reply_to_message_id: ctx.message.message_id }
    );
  }, 1000);

  try {
    await bookSlot(
      date,
      startTime,
      endTime,
      "2",
      "Student Activities",
      "Official use related to academic duties",
      purpose
    );
    clearInterval(intervalId);
    await ctx.telegram.editMessageText(
      bookingMessage.chat.id,
      bookingMessage.message_id,
      undefined,
      `Booking has been made successfully! 🎉\nTime elapsed: ${seconds} seconds\nBooking from: ${startTime} to ${endTime} on ${date}`,
      { reply_to_message_id: ctx.message.message_id }
    );
  } catch (error) {
    clearInterval(intervalId);
    if (error instanceof Error) {
      console.error("Booking failed", error);
      await ctx.telegram.editMessageText(
        bookingMessage.chat.id,
        bookingMessage.message_id,
        undefined,
        `Booking failed: ${error.message} 😢\nTime elapsed: ${seconds} seconds`,
        { reply_to_message_id: ctx.message.message_id }
      );
    } else {
      console.error("An unexpected error occurred:", error);
      await ctx.telegram.editMessageText(
        bookingMessage.chat.id,
        bookingMessage.message_id,
        undefined,
        `Booking failed due to an unexpected error. 😓\nTime elapsed: ${seconds} seconds`,
        { reply_to_message_id: ctx.message.message_id }
      );
    }
  }
});

bot.launch();
console.log("Bot is running... 🤖");
