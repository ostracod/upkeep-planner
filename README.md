
# Upkeep Planner

Web app to keep track of home maintenance tasks

## Requirements

This application has the following system-wide dependencies:

* Node.js version ^22.14
* pnpm version ^10.6
* TypeScript ^5.8

## Installation and Usage

To set up and run this application:

1. Clone this repository: `git clone https://github.com/ostracod/upkeep-planner`
1. Enter the repository directory: `cd ./upkeep-planner`
1. Install JavaScript dependencies: `pnpm install`
1. Compile TypeScript code: `tsc`
1. Create an environment variables file from the example file: `cp ./.env.example ./.env`
1. Adjust the content of `./.env` as necessary.
1. Copy your `ssl.key`, `ssl.crt`, and `ssl.ca-bundle` files into the `upkeep-planner` repository directory.
1. Run the application: `node ./dist/upkeepPlanner.js`

## Environment Variables

This application recognizes the following environment variables:

* `NODE_ENV` = `production` to run in production mode, or `development` to run in development mode
    * In development mode, the application runs without SSL files, and authentication can be bypassed
* `SESSION_SECRET` = Private string to compute session hash
* `PORT_NUMBER` = Port number on which to run the server


