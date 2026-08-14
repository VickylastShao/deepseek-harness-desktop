'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const {
  MAC_REQUIREMENTS,
  validateReleaseSigning,
  WINDOWS_REQUIREMENTS,
} = require('../scripts/validate-release-signing.cjs')

function completeEnvironment(windowsProvider) {
  return Object.fromEntries([
    ['DSH_RELEASE_SIGNING_REQUIRED', 'true'],
    ['WINDOWS_SIGNING_PROVIDER', windowsProvider],
    ...MAC_REQUIREMENTS.map(name => [name, `${name}-value`]),
    ...WINDOWS_REQUIREMENTS[windowsProvider].map(name => [name, `${name}-value`]),
  ])
}

test('non-release builds do not require signing credentials', () => {
  assert.deepEqual(validateReleaseSigning({}), {
    required: false,
    windowsProvider: null,
    missing: [],
  })
})

test('release builds report every absent macOS credential and the provider choice', () => {
  const result = validateReleaseSigning({ DSH_RELEASE_SIGNING_REQUIRED: 'true' })

  assert.equal(result.required, true)
  assert.deepEqual(result.missing, [
    ...MAC_REQUIREMENTS,
    'WINDOWS_SIGNING_PROVIDER (certificate or signpath)',
  ])
})

test('certificate-backed Windows signing accepts a complete release environment', () => {
  assert.deepEqual(validateReleaseSigning(completeEnvironment('certificate')), {
    required: true,
    windowsProvider: 'certificate',
    missing: [],
  })
})

test('SignPath-backed Windows signing accepts a complete release environment', () => {
  assert.deepEqual(validateReleaseSigning(completeEnvironment('signpath')), {
    required: true,
    windowsProvider: 'signpath',
    missing: [],
  })
})

test('blank secrets are treated as absent without exposing their contents', () => {
  const environment = completeEnvironment('signpath')
  environment.SIGNPATH_API_TOKEN = '   '

  const result = validateReleaseSigning(environment)

  assert.deepEqual(result.missing, ['SIGNPATH_API_TOKEN'])
})
