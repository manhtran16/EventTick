import React from "react";
import {
  BannerSection,
  SpecialEvent,
  TrendingEvent,
  ForYou,
  LatestEvent,
} from "@/features/events";

const HomePage = () => {
  return (
    <>
      <BannerSection />
      <SpecialEvent />
      <TrendingEvent />
      <ForYou />
      <LatestEvent />
    </>
  );
};

export default HomePage;
