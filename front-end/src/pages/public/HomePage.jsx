import React from "react";
import {
  BannerSection,
  FeaturedStars,
  SpecialEvent,
  TrendingEvent,
  ForYou,
  LatestEvent,
} from "@/features/events";

const HomePage = () => {
  return (
    <>
      <BannerSection />
      <FeaturedStars />
      <SpecialEvent />
      <TrendingEvent />
      <ForYou />
      <LatestEvent />
    </>
  );
};

export default HomePage;
