/**
 * Server Configuration with Environment Variable Validation
 *
 * Validates required environment variables and provides clear warnings.
 */

interface ServerConfig {
  port: number;
  host: string;
  anthropicApiKey: string | null;
  dockerSocket: string;
  authEnabled: boolean;
  authToken: string | null;
  nodeEnv: 'development' | 'production' | 'test';
}

/**
 * Validates and loads environment variables with warnings
 */
export function loadConfig(): ServerConfig {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Required for production: Anthropic API Key
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY || null;
  if (!anthropicApiKey && process.env.NODE_ENV === 'production') {
    errors.push('ANTHROPIC_API_KEY is required in production mode');
  } else if (!anthropicApiKey) {
    warnings.push('ANTHROPIC_API_KEY not set - AI features will be disabled');
  }

  // Optional: Authentication
  const authEnabled = process.env.AUTH_ENABLED === 'true';
  const authToken = process.env.AUTH_TOKEN || null;
  if (authEnabled && !authToken) {
    errors.push('AUTH_TOKEN is required when AUTH_ENABLED=true');
  }

  // Server configuration
  const port = parseInt(process.env.PORT || '8484', 10);
  const host = process.env.HOST || '0.0.0.0';
  const dockerSocket = process.env.DOCKER_SOCKET || '/var/run/docker.sock';
  const nodeEnv = (process.env.NODE_ENV || 'development') as ServerConfig['nodeEnv'];

  // Display warnings
  if (warnings.length > 0) {
    console.warn('\n⚠️  Configuration Warnings:');
    warnings.forEach((warning, i) => {
      console.warn(`  ${i + 1}. ${warning}`);
    });
    console.warn('');
  }

  // Display errors and exit if any
  if (errors.length > 0) {
    console.error('\n❌ Configuration Errors:');
    errors.forEach((error, i) => {
      console.error(`  ${i + 1}. ${error}`);
    });
    console.error('\nPlease set the required environment variables and try again.\n');
    process.exit(1);
  }

  const config: ServerConfig = {
    port,
    host,
    anthropicApiKey,
    dockerSocket,
    authEnabled,
    authToken,
    nodeEnv,
  };

  return config;
}

/**
 * Display current configuration (with secrets masked)
 */
export function displayConfig(config: ServerConfig): void {
  console.log('\n📋 Configuration:');
  console.log(`  Port:            ${config.port}`);
  console.log(`  Host:            ${config.host}`);
  console.log(`  Node Env:        ${config.nodeEnv}`);
  console.log(`  Docker Socket:   ${config.dockerSocket}`);
  console.log(`  Auth Enabled:    ${config.authEnabled}`);
  console.log(`  Anthropic API:   ${config.anthropicApiKey ? '✓ Set' : '✗ Not set'}`);
  if (config.authEnabled) {
    console.log(`  Auth Token:      ${config.authToken ? '***' : '✗ Not set'}`);
  }
  console.log('');
}
