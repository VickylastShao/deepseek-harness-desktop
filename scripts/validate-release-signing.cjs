'use strict'

const WINDOWS_PROVIDERS = new Set(['certificate', 'signpath'])

const MAC_REQUIREMENTS = [
  'MAC_CSC_LINK',
  'MAC_CSC_KEY_PASSWORD',
  'APPLE_API_KEY',
  'APPLE_API_KEY_ID',
  'APPLE_API_ISSUER',
  'APPLE_TEAM_ID',
]

const WINDOWS_REQUIREMENTS = {
  certificate: ['WIN_CSC_LINK', 'WIN_CSC_KEY_PASSWORD'],
  signpath: [
    'SIGNPATH_API_TOKEN',
    'SIGNPATH_ORGANIZATION_ID',
    'SIGNPATH_PROJECT_SLUG',
    'SIGNPATH_SIGNING_POLICY_SLUG',
    'SIGNPATH_ARTIFACT_CONFIGURATION_SLUG',
  ],
}

function hasValue(environment, name) {
  return typeof environment[name] === 'string' && environment[name].trim() !== ''
}

function validateReleaseSigning(environment) {
  if (environment.DSH_RELEASE_SIGNING_REQUIRED !== 'true') {
    return { required: false, windowsProvider: null, missing: [] }
  }

  const windowsProvider = environment.WINDOWS_SIGNING_PROVIDER?.trim() ?? ''
  const missing = MAC_REQUIREMENTS.filter(name => !hasValue(environment, name))
  if (!WINDOWS_PROVIDERS.has(windowsProvider)) {
    missing.push('WINDOWS_SIGNING_PROVIDER (certificate or signpath)')
  } else {
    missing.push(...WINDOWS_REQUIREMENTS[windowsProvider]
      .filter(name => !hasValue(environment, name)))
  }

  return { required: true, windowsProvider, missing }
}

function main() {
  const result = validateReleaseSigning(process.env)
  if (!result.required) {
    console.log('Release signing preflight skipped for this non-release build.')
    return
  }
  if (result.missing.length > 0) {
    throw new Error(`Release signing is required, but configuration is missing:\n- ${result.missing.join('\n- ')}`)
  }
  console.log(`Release signing preflight passed (Windows provider: ${result.windowsProvider}).`)
}

if (require.main === module) {
  try {
    main()
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}

module.exports = {
  MAC_REQUIREMENTS,
  validateReleaseSigning,
  WINDOWS_REQUIREMENTS,
}
