import { Link } from "react-router-dom";
import { MoveLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-50/50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border p-8 md:p-12">
        <Link to="/">
          <Button variant="ghost" className="mb-8 -ml-4 text-gray-500 hover:text-gray-900">
            <MoveLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </Link>
        
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-8">Privacy Policy</h1>
        
        <div className="prose prose-gray max-w-none text-gray-600 space-y-6">
          <p>Last updated: {new Date().toLocaleDateString()}</p>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">1. Information We Collect</h2>
            <p>
              <strong>Account Information:</strong> When you register, we collect your email address, display name, and authentication credentials.
            </p>
            <p>
              <strong>Content Data:</strong> We securely store the product images, links, and text prompts you upload to utilize our video generation service.
            </p>
            <p>
              <strong>Usage Data:</strong> We log system interactions, render durations, aspect ratios requested, and error codes for platform maintenance and queue optimization.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">2. How We Use Your Information</h2>
            <p>We use the collected information exclusively to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-2">
              <li>Provide, operate, and maintain the video rendering orchestrator.</li>
              <li>Process payments and deduct ledger credits securely.</li>
              <li>Analyze queue bottlenecks and resolve failed FFmpeg encoding sessions.</li>
              <li>Send administrative notices, such as render completion alerts.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">3. Data Security and Infrastructure</h2>
            <p>
              Viprosell v1.2 utilizes isolated database layers. Your uploaded media assets are temporarily transported to our secure Render Workers and FaceFusion GPU environments. Rendered MP4 binaries are securely hosted in isolated cloud buckets.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">4. Third-Party Interactions</h2>
            <p>
              We integrate with Stripe/PayPal for payment webhooks, and utilize external AI APIs (where Administrator Settings permit) for text completion. No personally identifiable marketing data is traded.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">5. User Rights</h2>
            <p>
              You maintain the right to instantly delete your projects, assets, and overall account profile from the platform at any time via your Account settings.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
