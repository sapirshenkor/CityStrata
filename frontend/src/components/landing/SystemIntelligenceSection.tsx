import type { LucideIcon } from 'lucide-react'
import { Boxes, MapPin, Radar, Scale, Sparkles, UsersRound } from 'lucide-react'

const stages: { title: string; description: string; icon: LucideIcon }[] = [
  {
    icon: Radar,
    title: 'איחוד שכבות GIS',
    description: 'נתונים מרחביים ועירוניים במקום אחד, מוכנים לניתוח.',
  },
  {
    icon: MapPin,
    title: 'ניתוח מרחבי',
    description: 'קרבה, נגישות והקשר שירותים סביב כל אתר.',
  },
  {
    icon: Boxes,
    title: 'דפוסים ואשכולות',
    description: 'קיבוץ אזורים ואיתותים לסדר עדיפויות תפעולי.',
  },
  {
    icon: Sparkles,
    title: 'המלצות מדורגות',
    description: 'חלופות מדורגות לפי קריטריונים שהוגדרו מראש.',
  },
  {
    icon: UsersRound,
    title: 'התאמה קהילתית',
    description: 'צרכי משפחה ורציפות קהילתית בתוך השיקול.',
  },
  {
    icon: Scale,
    title: 'תמיכה בהחלטה',
    description: 'תמונה ברורה לרשות, למשפחה ולצוותי השטח.',
  },
]

export function SystemIntelligenceSection() {
  return (
    <section
      className="border-y border-border/50 bg-gradient-to-b from-background via-card/15 to-background px-4 py-24 sm:py-28"
      aria-labelledby="intelligence-heading"
    >
      <div className="mx-auto max-w-5xl">
        <header className="mx-auto max-w-2xl text-center">
          <p className="mb-3 text-sm font-medium text-primary">מנוע ההחלטה</p>
          <h2 id="intelligence-heading" className="text-3xl font-semibold tracking-tight sm:text-4xl">
            איך המערכת חושבת
          </h2>
          <p className="mt-5 text-base leading-8 text-muted-foreground sm:text-lg">
            מנתון מרחבי להחלטה, זרימה שקטה, בלי רעש ויזואלי ובלי לוח בקרה.
          </p>
        </header>

        <ol className="mt-20 list-none space-y-14 sm:mt-24 sm:grid sm:grid-cols-2 sm:gap-x-10 sm:gap-y-16 sm:space-y-0 lg:grid-cols-3">
          {stages.map((stage) => {
            const Icon = stage.icon
            return (
              <li key={stage.title}>
                <div className="flex flex-col items-center text-center sm:items-end sm:text-right">
                  <div className="mb-5 flex h-9 w-9 items-center justify-center rounded-full border border-border/80 bg-card/80 text-primary shadow-sm">
                    <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                  </div>
                  <h3 className="text-base font-semibold leading-snug tracking-tight">{stage.title}</h3>
                  <p className="mt-2 max-w-[22rem] text-sm leading-7 text-muted-foreground">{stage.description}</p>
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
