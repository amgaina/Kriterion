import Navbar from "@/components/landing/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import DeviceShowcase from "@/components/landing/DeviceShowcase";
import FeaturesSection from "@/components/landing/FeaturesSection";
import LanguagesSection from "@/components/landing/LanguagesSection";
import CTASection from "@/components/landing/CTASection";
import Footer from "@/components/landing/Footer";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <Navbar />
      <HeroSection />
      <DeviceShowcase />
      <FeaturesSection />
      <LanguagesSection />
      <CTASection />
      <Footer />
    </main>
  );
}
