import re

with open("apps/api/src/routers/onboarding.ts", "r") as f:
    content = f.read()

content = content.replace("await db.update(policyVersions)\n        .set({ status: 'published' })", "// no status in policyVersions")
content = content.replace("await db.update(policyVersions)\n        .set({ publishedAt: new Date() })", "// no publishedAt in policyVersions")

with open("apps/api/src/routers/onboarding.ts", "w") as f:
    f.write(content)
