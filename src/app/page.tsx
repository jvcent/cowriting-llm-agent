"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import CaptchaComponent from "@/components/Captcha";
import { useFlow } from "@/context/FlowContext";

export default function Terms() {
  const router = useRouter();
  const { saveMTurkData } = useFlow();
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [captchaPassed, setCaptchaPassed] = useState(false);
  const [userCaptchaInput, setUserCaptchaInput] = useState("");
  const [captchaSolution, setCaptchaSolution] = useState("");

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const assignmentId = searchParams.get("assignmentId");
    const hitId = searchParams.get("hitId");
    const turkSubmitTo = searchParams.get("turkSubmitTo");
    const workerId = searchParams.get("workerId");

    if (assignmentId && hitId && turkSubmitTo && workerId) {
      saveMTurkData({
        assignmentId,
        hitId,
        turkSubmitTo,
        workerId,
      });
    }
  }, [saveMTurkData]);

  const handleCaptchaVerification = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      userCaptchaInput.trim().toUpperCase() === captchaSolution.toUpperCase()
    ) {
      setCaptchaPassed(true);
    } else {
      alert("Incorrect captcha answer. Please try again.");
    }
  };

  const handleContinue = () => {
    // Randomly redirect to one of the three experiences
    const routes = ["/single", "/group", "/solo"];
    const randomIndex = Math.floor(Math.random() * routes.length);
    router.push(routes[randomIndex]);
  };

  // If captcha hasn't been passed yet, show the captcha test
  if (!captchaPassed) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#2D0278] to-[#0A001D] p-8 flex flex-col items-center justify-center">
        <div className="w-full max-w-md bg-white bg-opacity-10 rounded-xl p-8 shadow-lg text-white">
          <h1 className="text-2xl font-bold mb-4 text-center">
            Captcha Verification
          </h1>
          <p className="mb-4">
            Please solve the following captcha to continue:
          </p>
          <CaptchaComponent
            onChange={(solution) => setCaptchaSolution(solution)}
          />
          <form onSubmit={handleCaptchaVerification}>
            <input
              type="text"
              value={userCaptchaInput}
              onChange={(e) => setUserCaptchaInput(e.target.value)}
              className="w-full p-2 mb-4 rounded text-black"
              placeholder="Enter The Captcha"
            />
            <button
              type="submit"
              className="w-full p-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
            >
              Verify
            </button>
          </form>
        </div>
      </div>
    );
  }

  // If captcha passed, show the Terms and Conditions page
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#2D0278] to-[#0A001D] p-8 flex flex-col items-center justify-center">
      <div className="w-full h-full max-w-3xl bg-white bg-opacity-10 rounded-xl p-8 shadow-lg">
        <h1 className="text-3xl font-bold text-white text-center mb-6">
          Terms and Conditions
        </h1>
        <div className="h-full w-full overflow-y-auto bg-white bg-opacity-5 p-6 rounded-lg mb-6 text-white">
          {/* Paste your terms content here */}
          <p className="mb-4 font-bold">
            University of Toronto Research Project Participation Consent Form
          </p>
          <p className="mb-4">
          The purpose of this project is to study how interactions with different types of AI collaborators affect people’s performance in a creative writing task.
          <br />
         This study aims to explore whether interacting with multiple AI “voices” can simulate the benefits of human group collaboration—such as increased idea diversity and richer discussions—while also examining potential drawbacks like idea homogenization and over-reliance on AI-generated content.
          </p>
          {/* ... additional terms content ... */}
          <p className="mb-4">
            By clicking the survey, you agree that:
            <br />
            • You have read and understood the information on this sheet;
            <br />
            • You are at least 18 years of age;
            <br />
            • You consent to participation and data collection for the
            aforementioned purposes;
            <br />
            • You may freely withdraw until the aforementioned date;
            <br />• You assign to the researchers all copyright of your survey
            contributions for use in all current and future work stemming from
            this project.
          </p>
          <p className="mb-4 text-red-500">
            Important: Please do not take screenshots, copy any text, or consult
            external tools (e.g., ChatGPT).
          </p>
          <p className="mb-4">
            We&apos;re just interested in your best effort and what you learn.
            The experiment will be ruined if you take screenshots or use
            external tools to do this task. So please do not do so! In fact, you
            have no reason to do so because you are not paid based on
            performance.
          </p>
          <p className="mb-4 text-red-500">
            Please do not refresh the page. Refreshing the page will lose any
            progress you have made and you may not receive any compensation
          </p>

          <div className="flex justify-center">
            <Image
              src="/cheat_icon.png"
              alt="No cheating icon"
              width={100}
              height={100}
              className="opacity-80"
              priority
            />
          </div>
        </div>

        <div className="flex items-center mb-8">
          <input
            type="checkbox"
            id="accept-terms"
            checked={termsAccepted}
            onChange={() => setTermsAccepted(!termsAccepted)}
            className="mr-3 h-5 w-5"
          />
          <label htmlFor="accept-terms" className="text-white">
            I have read and agree to the terms and conditions
          </label>
        </div>

        <div className="flex flex-col items-center space-y-6">
          <button
            onClick={handleContinue}
            disabled={!termsAccepted}
            className={`px-6 py-3 rounded-xl border-2 transition-all ${
              termsAccepted
                ? "px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md cursor-pointer"
                : "bg-gray-700 border-gray-600 cursor-not-allowed opacity-50"
            }`}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
