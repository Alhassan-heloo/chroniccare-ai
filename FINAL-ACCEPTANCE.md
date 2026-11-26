# Final Acceptance — ChronicCare AI v1.0.0

**Candidate** · `bb99da73326d5a513343b001f4050105729a051b`

**Decision** · Ready for owner review of the graduation release package

## Acceptance checklist

| Item | Evidence or decision |
| --- | --- |
| Production identity | GitHub `main` and the live Render deploy match the candidate. Readiness returned HTTP `200`. |
| Database compatibility | Migration 018 was separately verified. The current release has no pre-deploy migration command. |
| Product evidence | Focused synthetic patient, doctor, admin, authentication and consent integration and regression suites passed. |
| Public artifact review | Confirm the selected screenshots show fictional data and the release text contains no operational credentials, recovery records or private reports. |
| Attribution | Confirm presentation name, individual work and any additional collaborator credit before publication. |
| Licensing | No project-wide license was found in the reviewed tree. Confirm distribution rights before changing repository visibility or adding a project license. |
| Release decision | Owner approval pending for the tag and public GitHub release. Documentation publication may be approved separately. |

[Verification and limitations](FINAL-PROJECT-STATUS.md) · [Release text](RELEASE-NOTES-v1.0.0.md)

## Gate A — Documentation publication

The 20 paths below constitute the documentation publication set. Publication to `main` is expected to trigger the existing Render on-commit build even though application code and migrations are unchanged. Approval of this gate must expressly cover that automatic deployment. The newly deployed SHA would be the documentation commit, with an unchanged application tree.

After approval, run from the repository root in PowerShell.

~~~powershell
$base = 'bb99da73326d5a513343b001f4050105729a051b'
$files = @(
  'README.md'
  'RELEASE-NOTES-v1.0.0.md'
  'FINAL-PROJECT-STATUS.md'
  'FINAL-ACCEPTANCE.md'
  'GRADUATION-DEMO.md'
  'PORTFOLIO-CASE-STUDY.md'
  'docs/render-same-origin.md'
  'docs/release-assets/README.md'
  'docs/release-assets/diagrams/database-relationships.drawio'
  'docs/release-assets/diagrams/database-relationships.drawio.png'
  'docs/release-assets/diagrams/invitation-consent.drawio'
  'docs/release-assets/diagrams/invitation-consent.drawio.png'
  'docs/release-assets/diagrams/system-architecture.drawio'
  'docs/release-assets/diagrams/system-architecture.drawio.png'
  'docs/release-assets/screenshots/doctor-record-en.png'
  'docs/release-assets/screenshots/home-en.png'
  'docs/release-assets/screenshots/invitation-confirmation-en.png'
  'docs/release-assets/screenshots/invitation-review-ar.png'
  'docs/release-assets/screenshots/patient-dashboard-ar.png'
  'docs/release-assets/screenshots/patient-mobile-ar.png'
)
if ((git branch --show-current) -ne 'main' -or (git rev-parse HEAD) -ne $base) { throw 'Review the local baseline.' }
$remote = git ls-remote --exit-code origin refs/heads/main
if ($LASTEXITCODE -ne 0 -or $remote -notmatch "^$base\s+refs/heads/main$") { throw 'Review the remote baseline.' }
if (git diff --cached --name-only) { throw 'Review existing staged files.' }
$pending = @(git diff --name-only HEAD; git ls-files --others --exclude-standard) | Sort-Object -Unique
if (Compare-Object @($files | Sort-Object) @($pending)) { throw 'Unexpected pending files.' }
git add -- $files
if ($LASTEXITCODE -ne 0) { throw 'Staging failed.' }
$staged = @(git diff --cached --name-only | Sort-Object)
if (Compare-Object @($files | Sort-Object) $staged) { throw 'Unexpected staged files.' }
git diff --cached --check
if ($LASTEXITCODE -ne 0) { throw 'Whitespace check failed.' }
git diff --cached --stat
git diff --cached
~~~

Review the staged diff. If it matches the package approved under Gate A, run this second block in the same session.

~~~powershell
$tree = git write-tree
if ($LASTEXITCODE -ne 0) { throw 'Could not record the staged tree.' }
git commit -m 'Document ChronicCare AI v1.0.0 graduation release'
if ($LASTEXITCODE -ne 0 -or (git rev-parse 'HEAD^{tree}') -ne $tree -or (git rev-parse 'HEAD^') -ne $base) { throw 'Commit mismatch.' }
$docsCommit = git rev-parse HEAD
$remote = git ls-remote --exit-code origin refs/heads/main
if ($LASTEXITCODE -ne 0 -or $remote -notmatch "^$base\s+refs/heads/main$") { throw 'Review the remote baseline.' }
git push origin HEAD:refs/heads/main
if ($LASTEXITCODE -ne 0) { throw 'Inspect the remote state before continuing.' }
$remote = git ls-remote --exit-code origin refs/heads/main
if ($LASTEXITCODE -ne 0 -or $remote -notmatch "^$docsCommit\s+refs/heads/main$") { throw 'Documentation commit is unverified.' }
~~~

Verify the README, images and document links on GitHub. On Render, confirm the expected documentation SHA becomes `live` and readiness returns `200`, `status=ok` and `database=up`. Keep the previous SHA recorded as the application release target. Pause on build or health failure and obtain separate authorization for any rollback. [Render deployment](https://dashboard.render.com/web/srv-dbuu9olckfvc73a9u9j0)

## Gate B — GitHub Release v1.0.0

The annotated tag points to the **verified application commit**. GitHub generates source archives from that tagged tree, so newer documentation and assets may be absent from the generated ZIP and tarball. The release notes and manually attached assets below are distributed separately. The title is **ChronicCare AI v1.0.0 — Graduation Project Release**. [Final release notes](RELEASE-NOTES-v1.0.0.md)

~~~powershell
$release = 'bb99da73326d5a513343b001f4050105729a051b'
git cat-file -e "$release^{commit}"
if ($LASTEXITCODE -ne 0) { throw 'Release commit is unavailable locally.' }

$approvedDocsCommit = '' # If Gate A ran first, insert its verified docs-only SHA.
$remoteMain = git ls-remote --exit-code origin refs/heads/main
if ($LASTEXITCODE -ne 0 -or $remoteMain -notmatch '^([0-9a-f]{40})\s+refs/heads/main$' -or $Matches[1] -notin @($release,$approvedDocsCommit)) {
  throw 'Review the changed remote release baseline before tagging.'
}
$remoteTag = git ls-remote origin refs/tags/v1.0.0 'refs/tags/v1.0.0^{}'
if ($LASTEXITCODE -ne 0 -or $remoteTag -or (git tag --list 'v1.0.0')) {
  throw 'Could not verify tag availability or v1.0.0 already exists.'
}

git tag -a v1.0.0 $release -m 'ChronicCare AI v1.0.0 — Graduation Project Release'
if ($LASTEXITCODE -ne 0 -or (git rev-parse 'v1.0.0^{commit}') -ne $release) {
  throw 'Tag verification failed.'
}
git push origin refs/tags/v1.0.0
if ($LASTEXITCODE -ne 0) { throw 'Inspect the remote tag before taking further action.' }
$published = git ls-remote origin 'refs/tags/v1.0.0^{}'
if ($LASTEXITCODE -ne 0 -or $published -notmatch "^$release\s+refs/tags/v1\.0\.0\^\{\}$") {
  throw 'The published tag target is unverified.'
}
~~~

Once the GitHub release text is approved, an authorized operator with authenticated GitHub CLI access can create the draft and review it in the GitHub UI. Paste or upload only the reviewed public material. Update the draft to publish it only after the publication approval.

~~~powershell
gh release create v1.0.0 --repo Alhassan-heloo/chroniccare-ai --verify-tag --draft --title 'ChronicCare AI v1.0.0 — Graduation Project Release' --notes-file RELEASE-NOTES-v1.0.0.md
~~~

The release attachment allowlist consists of these 12 files, subject to the owner’s rights and attribution review. Public notes are supplied by the command above.

+- `docs/release-assets/diagrams/database-relationships.drawio`
- `docs/release-assets/diagrams/database-relationships.drawio.png`
- `docs/release-assets/diagrams/invitation-consent.drawio`
- `docs/release-assets/diagrams/invitation-consent.drawio.png`
- `docs/release-assets/diagrams/system-architecture.drawio`
- `docs/release-assets/diagrams/system-architecture.drawio.png`
- `docs/release-assets/screenshots/doctor-record-en.png`
- `docs/release-assets/screenshots/home-en.png`
- `docs/release-assets/screenshots/invitation-confirmation-en.png`
- `docs/release-assets/screenshots/invitation-review-ar.png`
- `docs/release-assets/screenshots/patient-dashboard-ar.png`
- `docs/release-assets/screenshots/patient-mobile-ar.png`

Attach the listed files to the draft through GitHub. Before publishing, verify the peeled tag SHA, title, note text, attachment names and downloads. Publish the reviewed draft only under the explicit Gate B approval. If Gate A already ran, check Render against the approved documentation SHA and keep the tag at the application SHA.

After publication, verify GitHub shows v1.0.0 at the expected SHA and Render still serves the known release. Application redeployment and database migration are outside this tag-and-release procedure.

**اعتماد A** · أؤكد الإسناد وحقوق النشر، وأوافق على التزام ملفات التوثيق العشرين ودفعها إلى `main` وعلى نشر Render التلقائي المتوقع.

**اعتماد B** · أؤكد الإسناد وحقوق توزيع شيفرة الالتزام والأصول المحددة، وأوافق على إنشاء وسم `v1.0.0` على الالتزام المذكور ودفعه ونشر GitHub Release بالنص والمرفقات المراجعة.
