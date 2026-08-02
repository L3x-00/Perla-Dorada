import { lazy, Suspense } from "react";

import { About } from "@/components/site/about";
import { Hero } from "@/components/site/hero";
import { NoRaffle } from "@/components/site/no-raffle";
import { RaffleSection } from "@/components/site/raffle-section";
import { RealtimeRaffleWatcher } from "@/components/site/realtime-raffle-watcher";
import { Showcase } from "@/components/site/showcase";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { WinnerShowcase } from "@/components/site/winner-showcase";
import { getActivePublicPromotions } from "@/lib/promotions/public-promotions";
import { getLatestClosedRaffleWinners } from "@/lib/raffles/public-winners";
import {
  getActivePublicRaffle,
  type ActivePublicRaffle,
} from "@/lib/raffles/public-raffle";

/*
 * Cargado perezoso: el modal de promociones no es parte del camino crítico
 * de la portada (aparece recién a los 2s), así que su JS no debe sumarse al
 * bundle inicial.
 */
const PromoCarouselModal = lazy(() =>
  import("@/components/site/promo-carousel-modal").then((mod) => ({
    default: mod.PromoCarouselModal,
  })),
);

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let raffle: ActivePublicRaffle | null = null;
  let loadFailed = false;

  try {
    raffle = await getActivePublicRaffle();
  } catch (error) {
    console.error("Error cargando la rifa activa:", error);
    loadFailed = true;
  }

  /*
   * La sección del sorteo solo aparece cuando hay uno vigente. El resto del
   * año la web sigue funcionando como sitio de la joyería.
   */
  const showRaffle = !loadFailed && raffle !== null;

  /*
   * No crítico para la portada: si falla, simplemente no hay modal de
   * promociones, no debe tumbar la página.
   */
  let promotions: Awaited<ReturnType<typeof getActivePublicPromotions>> = [];
  try {
    promotions = await getActivePublicPromotions();
  } catch (error) {
    console.error("Error cargando promociones:", error);
  }

  /*
   * Solo hace falta consultar ganadores cuando no hay rifa activa (si la
   * hay, RaffleSection ocupa el lugar y esta consulta sería trabajo
   * perdido). Tampoco es crítico: si falla, cae al estado "sin sorteo".
   */
  let latestWinners: Awaited<ReturnType<typeof getLatestClosedRaffleWinners>> =
    null;

  if (!loadFailed && !raffle) {
    try {
      latestWinners = await getLatestClosedRaffleWinners();
    } catch (error) {
      console.error("Error cargando ganadores:", error);
    }
  }

  return (
    <>
      <RealtimeRaffleWatcher />
      {promotions.length > 0 ? (
        <Suspense fallback={null}>
          <PromoCarouselModal promotions={promotions} />
        </Suspense>
      ) : null}
      <SiteHeader />

      <main className="flex-1">
        <Hero hasActiveRaffle={showRaffle} />

        {loadFailed ? (
          <NoRaffle
            notice={{
              title: "No pudimos cargar el sorteo",
              message:
                "Ocurrió un problema al consultar la información. Vuelve a intentarlo en unos minutos.",
            }}
          />
        ) : raffle ? (
          <RaffleSection raffle={raffle} />
        ) : latestWinners ? (
          <WinnerShowcase winners={latestWinners} />
        ) : (
          <NoRaffle />
        )}

        <Showcase />
        <About />
      </main>

      <SiteFooter />
    </>
  );
}
