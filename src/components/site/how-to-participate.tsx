import { Reveal } from "@/components/site/reveal";

const STEPS = [
  {
    title: "Elige tus boletos",
    detail:
      "Indica cuántos boletos quieres. El total se calcula al instante y se reserva mientras completas el pago.",
  },
  {
    title: "Paga por Yape",
    detail:
      "Transfiere el monto exacto a la cuenta indicada y toma captura del comprobante.",
  },
  {
    title: "Completa tus datos",
    detail:
      "Llena el formulario con tu nombre, DNI y contacto, y adjunta la captura del pago.",
  },
  {
    title: "Guarda tu código",
    detail:
      "Recibirás un código de seguimiento. Consérvalo: con él y tu DNI consultas tu solicitud.",
  },
  {
    title: "Validamos tu pago",
    detail:
      "Revisamos el comprobante manualmente. Si todo está correcto, se te asignan los números.",
  },
  {
    title: "Descarga tus boletos",
    detail:
      "Una vez aprobada, descarga e imprime tus boletos con los números asignados.",
  },
];

export function HowToParticipate() {
  return (
    <div>
      <Reveal>
        <p className="eyebrow text-gold">Cómo participar</p>
        <h3 className="mt-4 font-display text-3xl font-light text-cream sm:text-4xl">
          Seis pasos, sin complicaciones
        </h3>
      </Reveal>

      <ol className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {STEPS.map((step, index) => (
          <Reveal key={step.title} delay={index * 0.06}>
            <li className="list-none border-t border-line pt-5">
              <span className="font-display text-2xl font-light text-gold">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h4 className="mt-2 text-base font-medium text-cream">
                {step.title}
              </h4>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {step.detail}
              </p>
            </li>
          </Reveal>
        ))}
      </ol>
    </div>
  );
}
