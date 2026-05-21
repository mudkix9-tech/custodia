import re

with open("apps/web/src/components/onboarding/Step4GeneratePolicy.tsx", "r") as f:
    content = f.read()

replacement = """
  if (!policyPreview) {
    return (
      <div className="bg-white p-8 rounded-xl shadow-sm border max-w-4xl mx-auto w-full text-center">
        <h2 className="text-2xl font-bold mb-4 text-gray-900">Add processing activities first</h2>
        <p className="text-gray-500 mb-8">
          We need to know what data you process to generate a meaningful privacy policy.
        </p>
        <button
          onClick={() => handleNext(false)}
          className="text-blue-600 hover:text-blue-800 font-medium px-4 py-2"
        >
          Skip for now
        </button>
      </div>
    );
  }
"""

content = content.replace("  const handleNext = (publish: boolean) => {", replacement + "\n  const handleNext = (publish: boolean) => {")

with open("apps/web/src/components/onboarding/Step4GeneratePolicy.tsx", "w") as f:
    f.write(content)
