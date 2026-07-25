param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('rules', 'functions', 'hosting')]
  [string]$Only
)

if ($env:CONFIRM_LAUNDRYOPS_STAGING_DEPLOY -ne 'yes') {
  throw 'Set CONFIRM_LAUNDRYOPS_STAGING_DEPLOY=yes for this PowerShell session before deploying staging.'
}

$root = Split-Path -Parent $PSScriptRoot
$config = Join-Path $root 'firebase.staging.json'

Push-Location $root
try {
  switch ($Only) {
    'rules' { npx.cmd firebase-tools deploy --config $config --project laundryops-staging --only firestore:rules,storage }
    'functions' { npx.cmd firebase-tools deploy --config $config --project laundryops-staging --only functions:indexOrganizationManual,functions:reindexOrganizationManuals,functions:generateRepairAssist,functions:completeManualOcrJobs,functions:requestDocumentationDiscovery,functions:submitDocumentationCandidateUrl,functions:reviewDocumentationCandidate,functions:attachApprovedDocumentationCandidate,functions:updateOrganizationDocumentationSettings,functions:cancelDocumentationDiscovery,functions:updateGlobalDocumentationSettings }
    'hosting' { npx.cmd firebase-tools deploy --config $config --project laundryops-staging --only hosting }
  }
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
  Pop-Location
}
