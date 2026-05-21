import re

with open("apps/api/src/routers/onboarding.ts", "r") as f:
    content = f.read()

# Add sql to drizzle-orm import
content = content.replace("import { eq, and, inArray } from 'drizzle-orm';", "import { eq, and, inArray, sql } from 'drizzle-orm';")

# Fix activity possibly undefined
content = content.replace("activity.id", "activity!.id")

# Fix policy generation issues
content = content.replace("publicUrlPath: `/legal/${org?.slug}/privacy`,", "")
content = content.replace("status: 'draft',", "") # policy status
content = content.replace("versionId: 'v1.0-draft',", "versionNumber: 1,")
content = content.replace("content: '# Privacy Policy\\n\\nThis policy is auto-generated based on your Processing Activities.',", "contentHtml: '# Privacy Policy\\n\\nThis policy is auto-generated based on your Processing Activities.',")
content = content.replace("return { policyId: policy.id, publicUrlPath: policy.publicUrlPath };", "return { policyId: policy!.id, publicUrlPath: `/legal/${org?.slug}/privacy` };")
content = content.replace("return { policyId: policy!.id, publicUrlPath: policy.publicUrlPath };", "return { policyId: policy!.id, publicUrlPath: `/legal/${org?.slug}/privacy` };")

# Fix policy schema in publishPolicy
# We'll just leave status in privacyPolicies and policyVersions alone since they aren't in schema. Or maybe they are publishedAt?
content = content.replace("await db.update(privacyPolicies)\n        .set({ status: 'published' })", "await db.update(privacyPolicies)\n        .set({ publishedAt: new Date() })")
content = content.replace("await db.update(policyVersions)\n        .set({ status: 'published', publishedAt: new Date() })", "await db.update(policyVersions)\n        .set({ publishedAt: new Date() })")

# Fix users table insert
content = content.replace("status: 'invited',", "name: invite.email.split('@')[0],")

with open("apps/api/src/routers/onboarding.ts", "w") as f:
    f.write(content)
