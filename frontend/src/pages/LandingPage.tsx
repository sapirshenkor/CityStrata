import { lazy, Suspense } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Bot,
  Building2,
  ChevronLeft,
  Layers,
  Map,
  Radar,
  Sparkles,
  Users,
} from 'lucide-react'
import { AppHeader } from '@/components/layout/AppHeader'
import { SystemIntelligenceSection } from '@/components/landing/SystemIntelligenceSection'
import { LandingHeroMapSkeleton } from '@/components/Map/LandingHeroMapSkeleton'
import UserBar from '@/components/UserBar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

const LandingHeroMap = lazy(() => import('@/components/Map/LandingHeroMap'))

const capabilities = [
  {
    icon: Layers,
    title: 'שכבות GIS חיות',
    description: 'איחוד אזורים סטטיסטיים, תשתיות, שירותים ונקודות עניין לתמונת מצב מרחבית אחת.',
  },
  {
    icon: Users,
    title: 'פרופילי משפחות וקהילות',
    description: 'איסוף צרכים, מגבלות והעדפות של משקי בית כדי לשמר רציפות קהילתית בזמן פינוי.',
  },
  {
    icon: Sparkles,
    title: 'המלצות מבוססות התאמה',
    description: 'דירוג חלופות לפי נתונים מרחביים, מאפייני המשפחה והקשר תפעולי בזמן אמת.',
  },
  {
    icon: Bot,
    title: 'סוכנים חכמים',
    description: 'תהליכי ניתוח אוטומטיים שמסייעים לצוותים להבין, לתעדף ולפעול מהר יותר.',
  },
]

const processSteps = [
  {
    label: '01',
    title: 'אוספים נתונים',
    description: 'שכבות עירוניות, שירותים, מתקנים, מאפייני אזורים ופרופילי משפחות מוזנים למערכת.',
  },
  {
    label: '02',
    title: 'בונים הקשר מרחבי',
    description: 'המערכת מחברת בין מיקום, נגישות, זמינות שירותים ומאפייני קהילה כדי לייצר תמונת מצב.',
  },
  {
    label: '03',
    title: 'מקבלים המלצות',
    description: 'הרשות והמשפחה מקבלות חלופות פעולה ברורות, מדורגות ומוסברות לפי הצרכים בפועל.',
  },
]

const audiences = [
  {
    icon: Building2,
    title: 'לרשות המקומית',
    description: 'קבלת החלטות מבוססת מפה, ניתוח עומסים, ניהול מתקנים ותעדוף אזורים בזמן אירוע.',
    to: '/municipality',
    cta: 'לוח הרשות',
  },
  {
    icon: Users,
    title: 'למשפחות וקהילות',
    description: 'תהליך מובנה להזנת צרכים וקבלת התאמות שמכבדות מגבלות, קרבה ושייכות קהילתית.',
    to: '/family',
    cta: 'לוח משפחתי',
  },
]

export default function LandingPage() {
  return (
    <div dir="rtl" className="flex min-h-screen flex-col bg-background text-foreground">
      <AppHeader variant="landing">
        <UserBar />
      </AppHeader>

      <main id="main-content" className="flex-1 overflow-hidden">
        <section className="relative border-b border-border/60 px-4 py-20 sm:py-24 lg:py-32">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.18),transparent_34%),radial-gradient(circle_at_bottom_right,hsl(var(--primary)/0.12),transparent_32%)]" />
          <div className="absolute inset-0 -z-10 opacity-[0.18] [background-image:linear-gradient(90deg,hsl(var(--border))_1px,transparent_1px),linear-gradient(hsl(var(--border))_1px,transparent_1px)] [background-size:72px_72px]" />

          <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="max-w-3xl">
              <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-4 py-2 text-sm text-muted-foreground shadow-sm backdrop-blur-sm">
                <Radar className="h-4 w-4 text-primary" aria-hidden />
                מערכת GIS חכמה לניהול פינוי עירוני
              </div>

              <h1 className="text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
                החלטות פינוי
                <span className="block text-primary">מבוססות מקום.</span>
                
              </h1>

              <p className="mt-7 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
                CityStrata מחברת בין שכבות GIS, פרופילי משפחות, מאפייני קהילה וסוכנים חכמים - כדי לסייע לרשות ולתושבים לקבל החלטות מהירות, שקופות ומדויקות בזמן אירוע פינוי.
              </p>

              <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap" role="group" aria-label="פעולות ראשיות">
                <Button asChild size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
                  <Link to="/map" className="gap-2">
                    כניסה למפת המערכת
                    <ArrowLeft className="h-4 w-4" aria-hidden />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/family">התחלה כמשפחה</Link>
                </Button>
                <Button asChild variant="secondary" size="lg">
                  <Link to="/login">התחברות</Link>
                </Button>
              </div>
            </div>

            <Suspense fallback={<LandingHeroMapSkeleton />}>
              <LandingHeroMap />
            </Suspense>
          </div>
        </section>

        <section className="px-4 py-20 sm:py-24" aria-labelledby="why-heading">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
              <div>
                <p className="mb-3 text-sm font-medium text-primary">למה CityStrata</p>
                <h2 id="why-heading" className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  בזמן חירום, מפה לבד לא מספיקה.
                </h2>
              </div>
              <p className="max-w-3xl text-base leading-8 text-muted-foreground sm:text-lg">
                פינוי רחב היקף דורש להבין לא רק איפה נמצאים מתקנים פנויים, אלא גם אילו שירותים זמינים סביבם, אילו משפחות מתאימות לכל חלופה, ואיך שומרים על רציפות קהילתית. המערכת מתרגמת נתונים מפוזרים לתמונה תפעולית אחת.
              </p>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {capabilities.map((item) => {
                const Icon = item.icon
                return (
                  <Card key={item.title} className="group border-border/70 bg-card/70 shadow-card transition duration-300 hover:-translate-y-1 hover:bg-card">
                    <CardContent className="p-6">
                      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-primary transition duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
                        <Icon className="h-6 w-6" aria-hidden />
                      </div>
                      <h3 className="text-lg font-semibold">{item.title}</h3>
                      <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.description}</p>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        </section>

        <section className="border-y border-border/60 bg-card/35 px-4 py-20 sm:py-24" aria-labelledby="process-heading">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="mb-3 text-sm font-medium text-primary">תהליך העבודה</p>
              <h2 id="process-heading" className="text-3xl font-semibold tracking-tight sm:text-4xl">
                מנתונים עירוניים להחלטות פעולה.
              </h2>
            </div>

            <ol className="mt-12 grid gap-5 lg:grid-cols-3">
              {processSteps.map((step) => (
                <li key={step.label} className="relative rounded-[1.75rem] border border-border/70 bg-background/65 p-7 shadow-sm backdrop-blur-sm">
                  <div className="mb-10 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{step.label}</span>
                    <ChevronLeft className="h-5 w-5 text-primary" aria-hidden />
                  </div>
                  <h3 className="text-xl font-semibold">{step.title}</h3>
                  <p className="mt-4 text-sm leading-7 text-muted-foreground">{step.description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <SystemIntelligenceSection />

        <section className="border-y border-border/60 bg-card/35 px-4 py-20 sm:py-24" aria-labelledby="audience-heading">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="mb-3 text-sm font-medium text-primary">שערי כניסה</p>
              <h2 id="audience-heading" className="text-3xl font-semibold tracking-tight sm:text-4xl">
                אותה מערכת, שתי נקודות מבט.
              </h2>
            </div>

            <div className="mt-12 grid gap-5 md:grid-cols-2">
              {audiences.map((audience) => {
                const Icon = audience.icon
                return (
                  <Card key={audience.title} className="border-border/70 bg-background/65 shadow-card transition duration-300 hover:-translate-y-1 hover:bg-background">
                    <CardContent className="p-7">
                      <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                        <Icon className="h-7 w-7" aria-hidden />
                      </div>
                      <h3 className="text-2xl font-semibold">{audience.title}</h3>
                      <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">{audience.description}</p>
                      <Button asChild variant="outline" className="mt-7">
                        <Link to={audience.to} className="gap-2">
                          {audience.cta}
                          <ArrowLeft className="h-4 w-4" aria-hidden />
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        </section>

        <section className="px-4 py-20 sm:py-24" aria-labelledby="cta-heading">
          <div className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] border border-border/70 bg-card p-8 shadow-card sm:p-12 lg:p-16">
            <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="mb-3 text-sm font-medium text-primary">CityStrata</p>
                <h2 id="cta-heading" className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  התחילו מהמפה, והמשיכו להחלטה.
                </h2>
                <p className="mt-5 max-w-3xl text-base leading-8 text-muted-foreground">
                  פתחו את המפה הראשית כדי לראות את השכבות, האזורים והכלים בזמן אמת. גישה ללוחות הבקרה תתבצע לפי הרשאות המשתמש.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <Button asChild size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
                  <Link to="/map" className="gap-2">
                    פתיחת מפה
                    <Map className="h-4 w-4" aria-hidden />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/municipality">לוח רשות</Link>
                </Button>
                <Button asChild variant="secondary" size="lg">
                  <Link to="/login">התחברות</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <footer className="border-t border-border/60 bg-card/60 px-4 py-10">
          <div className="mx-auto flex max-w-7xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">CityStrata</p>
              <p className="mt-1 text-xs text-muted-foreground">אילת · מערכת גיאו־מרחבית לניהול פינוי</p>
            </div>
            <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm" aria-label="קישורי תחתית">
              <Link to="/map" className="text-primary hover:underline">
                מפה
              </Link>
              <Link to="/family" className="text-primary hover:underline">
                משפחה
              </Link>
              <Link to="/municipality" className="text-primary hover:underline">
                רשות מקומית
              </Link>
              <Link to="/login" className="text-primary hover:underline">
                התחברות
              </Link>
            </nav>
          </div>
        </footer>
      </main>
    </div>
  )
}
