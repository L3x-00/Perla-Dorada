import { About } from "@/components/site/about";
import { Hero } from "@/components/site/hero";
import { NoRaffle } from "@/components/site/no-raffle";
import { RaffleSection } from "@/components/site/raffle-section";
import { RealtimeRaffleWatcher } from "@/components/site/realtime-raffle-watcher";
import { Showcase } from "@/components/site/showcase";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import {
  getActivePublicRaffle,
  type ActivePublicRaffle,
} from "@/lib/raffles/public-raffle";

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

  return (
    <>
      <RealtimeRaffleWatcher />
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
