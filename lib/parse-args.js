import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function parseArgs() {
  const args = process.argv.slice(2);
  let envFilePath = null;
  
  if (args.includes('--env-file')) {
    const envFileIndex = args.indexOf('--env-file');
    const envFile = args[envFileIndex + 1];
    
    // Remove the --env-file and its value from args
    args.splice(envFileIndex, 2);
    
    envFilePath = resolve(process.cwd(), envFile);
    // Load the environment variables from the specified file
    dotenv.config({ path: envFilePath });
  } else {
    // Load from default .env file
    dotenv.config();
  }
  
  return { args, envFilePath };
}

export default parseArgs;
