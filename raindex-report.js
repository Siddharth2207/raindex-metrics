

const fs = require('fs');
const path = require('path');

const {allowedTokens,allowedNetworks,allowedDurations} = require('./dist/config')
const {generateReportForToken} = require('./dist/generateReport')

function getEnvVariableValue(filePath, variableName) {
  const envPath = path.resolve(filePath);
  const envContent = fs.readFileSync(envPath, { encoding: 'utf-8' });

  // Find the specific variable
  const regex = new RegExp(`^${variableName}=([^\n\r]*)`, 'm');
  const match = envContent.match(regex);

  if (match) {
    return match[1].trim(); // Extract and trim the value
  }
  return undefined; // Return undefined if the variable is not found
}

function parseArguments(args) {
  const options = {};
  for (let i = 2; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("-")) {
      const key = arg.replace(/^-+/, ""); // Remove leading dashes
      const value = args[i + 1]; // Get the next value
      options[key] = value;
      i++; // Skip the next value as it's already processed
    }
  }
  return options;
}

function showHelp() {
  console.log(`
Usage: node your-script.js [options]

Options:
  -t, --token <symbol>    Token symbol. Any of [${allowedTokens.join(", ")}].
  -n, --network <name>    Network name. Any of [${allowedNetworks.join(", ")}].
  -d, --duration <duration> Duration. Any of [${allowedDurations.join(", ")}].
  --help                  Show this help message.

Example:
  node raindex-report.js --token IOEN --network polygon --duration daily
  `);
}

// Parse the arguments
const options = parseArguments(process.argv);
const openAiApiKey = getEnvVariableValue('.env', 'OPENAI_API_KEY');
// Check for help flag
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  showHelp();
  process.exit(0);
}

// Validate the required options
const { token, network, duration } = options;


// Generate the report
generateReportForToken(token, network, duration, openAiApiKey); 



