import re

with open("apps/api/src/routers/onboarding.ts", "r") as f:
    content = f.read()

# Fix policyVersions insert
content = content.replace("contentHtml: '# Privacy Policy\\n\\nThis policy is auto-generated based on your Processing Activities.',", "contentHtml: '# Privacy Policy\\n\\nThis policy is auto-generated based on your Processing Activities.', contentMarkdown: '# Privacy Policy\\n\\nThis policy is auto-generated based on your Processing Activities.',")
content = content.replace("versionId: 'v1.0'", "versionNumber: 1")

# Fix privacyPolicies update
content = content.replace("await db.update(privacyPolicies)\n        .set({ status: 'published' })", "await db.update(privacyPolicies)\n        .set({ publishedAt: new Date() })")

with open("apps/api/src/routers/onboarding.ts", "w") as f:
    f.write(content)
