# UTownFBS Booker

This project provides an automated way to book slots at UTownFBS using Puppeteer. It simulates a browser and fills out the necessary fields on the UTownFBS website to book a slot.

## Features

- Automated slot booking at UTownFBS
- Input customization for date and time slot selection, type of facility, and purpose of usage

## Prerequisites

- [Node.js](https://nodejs.org/en/)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)

## Installation

1. Clone the repo:

   ```
   git clone https://github.com/conradsoon/utownfbsBooker.git
   ```

2. Install dependencies:
   ```
   npm install
   ```

## Usage

To run the booking script, execute:
`    npm start
   `

You will need to provide the following environment variables:

- `UTOWNFBS_USER`: Your username
- `UTOWNFBS_PASS`: Your password

You can provide these by setting up a `.env` file in the root directory of the project.
