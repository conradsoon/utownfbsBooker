import puppeteer, { Frame, Page } from "puppeteer";

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
const bookSlot = async () => {
  //   await Promise.all([
  const browser = await puppeteer.launch({ headless: false });
  const page: Page = await browser.newPage();

  // Fill in the basic auth, replace 'username' and 'password' with your own credentials
  const username = process.env.UTOWNFBS_USER as string;
  const password = process.env.UTOWNFBS_PASS as string;

  // console.log(`Username: ${username}, Password: ${password}`);
  // Load the URL
  await page.authenticate({ username, password });
  //   await page.goto("https://utownfbs.nus.edu.sg/utown/apptop.aspx");
  await Promise.all([
    page.goto("https://utownfbs.nus.edu.sg/utown/apptop.aspx"),
    page.waitForNavigation({ waitUntil: "networkidle0" }),
  ]);
  const frames = await page.frames();
  // Iterate over each frame
  for (const frame of frames) {
    try {
      // Attempt to select the element
      await frame.waitForSelector('select[name="FacilityType$ctl02"]', {
        timeout: 5000,
      });
      console.log("Select element found in frame with URL:", frame.url());
      // Exit loop if element is found
      break;
    } catch (error) {
      console.log("Select element not found in frame with URL:", frame.url());
    }
  }
  // Obtain the frame where the element is found
  const targetFrame = frames.find(
    (frame) =>
      frame.url() ===
      "https://utownfbs.nus.edu.sg/utown/modules/booking/search.aspx"
  );
  // Extract options from the select element
  const options = await targetFrame!.$$eval(
    'select[name="FacilityType$ctl02"] > option',
    (options) => {
      return options.map((option) => option.value);
    }
  );
  console.log(options);
  // Use selectByText instead of the previous select function
  await selectByText(
    targetFrame!,
    'select[name="FacilityType$ctl02"]',
    "(Conference / Meeting Room) - Meeting Room / Learning Pod/ Study Cubicles"
  );

  // Perform action on the select element
  // await targetFrame!.select('select[name="FacilityType$ctl02"]', "optionValue");
  // Select a facility by name
  await targetFrame!.waitForTimeout(2000);
  await selectByText(
    targetFrame!,
    'select[name="Facility$ctl02"]',
    "MAC COMMONS LEARNING POD D1 (5 pax) (Education Resource Centre)"
  );
  // await targetFrame!.select('select[name="FacilityType$ctl02"]', "optionValue");
  //wait for 1000 0seconds
  await targetFrame!.waitForTimeout(2000);
  // Set the date
  await targetFrame!.evaluate(() => {
    const startDateField = <HTMLInputElement>(
      document.getElementById("StartDate_ctl03")
    );
    startDateField.value = "22-Jul-2023"; // replace 'your-date-here' with the date you want
  });

  await targetFrame!.evaluate(() => {
    const startDateField = <HTMLInputElement>(
      document.getElementById("StartDate_ctl10")
    );
    startDateField.value = "22-Jul-2023"; // replace 'your-date-here' with the date you want
  });

  // Click the 'Search Availability' button
  await targetFrame!.click("input#btnViewAvailability");

  // You might need to wait for navigation if the click leads to a new page
  // Note: This might not work as expected because `waitForNavigation` may not be fully compatible with frames. You might need to use a delay (`waitForTimeout`) or observe for some specific changes on the page.
  // try {
  // await targetFrame!.waitForNavigation({ timeout: 10000 });
  // } catch (e) {
  // console.log("Navigation timeout after 10 seconds");
  // }
  await targetFrame!.waitForTimeout(2000);
  const divAvailable = await targetFrame!.$(".divAvailable");
  await divAvailable!.click();

  await targetFrame!.waitForTimeout(10000);
  // Switching to the new iframe
  const iframeElement = await targetFrame!.$("#frmCreate");
  const newFrame = await iframeElement!.contentFrame();
  //set newframe to be not null
  //log newframe
  const htmlContent = await newFrame!.content();
  console.log(htmlContent);

  // Selecting start time
  await selectByText(newFrame!, 'select[name="from$ctl02"]', "09:00");
  await newFrame!.waitForTimeout(2000);
  await selectByText(newFrame!, 'select[name="to$ctl02"]', "09:30");
  await newFrame!.waitForTimeout(2000);

  // Filling in expected number of attendees
  await newFrame!.type('input[name="ExpectedNoAttendees$ctl02"]', "2");
  await newFrame!.waitForTimeout(2000);

  await selectByText(
    newFrame!,
    'select[name="UsageType$ctl02"]',
    "Student Activities"
  );
  await newFrame!.waitForTimeout(2000);

  await selectByText(
    newFrame!,
    'select[name="ChargeGroup$ctl02"]',
    "Official use related to academic duties"
  );
  await newFrame!.waitForTimeout(2000);

  // Writing the purpose
  await newFrame!.type('textarea[name="Purpose$ctl02"]', "Gym");
  await newFrame!.waitForTimeout(2000);
  await newFrame!.click("#btnCreateBooking");

  // You'd typically have a 'Submit' or 'Next' button to click after filling the form, like:
  // await newFrame!.click("input#submitButton");

  // Remember to switch back to the main frame when you are done with the iframe

  // Close the browser
  await newFrame!.waitForTimeout(2000);
  await browser.close();
};

bookSlot();
