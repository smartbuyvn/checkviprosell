import { Link } from "react-router-dom";
import { MoveLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-gray-50/50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border p-8 md:p-12">
        <Link to="/">
          <Button variant="ghost" className="mb-8 -ml-4 text-gray-500 hover:text-gray-900">
            <MoveLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </Link>
        
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-8">Terms of Service</h1>
        
        <div className="prose prose-gray max-w-none text-gray-600 space-y-6">
          <p>Last updated: {new Date().toLocaleDateString()}</p>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">1. Acceptance of Terms</h2>
            <p>
              By accessing and using Viprosell v1.2 ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">2. Description of Service</h2>
            <p>
              Viprosell provides AI-powered short commerce video creation tools. The Service allows users to upload product images and generate video content based on predefined templates and AI analysis.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">3. Credits and Billing</h2>
            <p>
              Services are consumed via a credit system. Credits are explicitly deducted ONLY upon the successful final compilation and encoding of a video project. Failed renders do not consume credits. Credits purchased are non-refundable unless required by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">4. Content Ownership and Usage</h2>
            <p>
              You retain all rights to the source images and content you upload. By using the Service, you grant Viprosell a temporary license to process, store, and modify these assets solely for the purpose of generating your requested videos.
            </p>
            <p>
              You are strictly prohibited from utilizing the FaceFusion or general rendering tools to generate deceptive, illicit, or harmful content.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">5. Limitation of Liability</h2>
            <p>
              The Service is provided "as is" without warranty of any kind. Viprosell shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the Service.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
