import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Bot,
  Layers,
  Map,
  Sparkles,
  Users,
} from 'lucide-react'
import { AppHeader } from '@/components/layout/AppHeader'
import UserBar from '@/components/UserBar'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <AppHeader variant="landing">
        <UserBar />
      </AppHeader>

      <main id="main-content" className="flex-1">
        <section className="border-b border-border bg-card/80 px-4 py-12 sm:py-16">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              CityStrata
            </h1>
            <p className="mt-3 text-base text-muted-foreground sm:text-lg">
            מערכת גיאו-מרחבית לניהול פינוי באילת: תמונת מצב מבוססת מפה, פרופילי משפחות
            והמלצות חכמות בממשק אחד.
            </p>
            <div
              className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:justify-center"
              role="group"
              aria-label="פעולות ראשיות"
            >
              <Button asChild size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Link to="/map">כניסה למפת המערכת</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/family">לוח בקרה משפחתי</Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link to="/login">התחברות</Link>
              </Button>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-5xl space-y-14 px-4 py-12 sm:py-16">
          <section aria-labelledby="problem-heading">
            <h2 id="problem-heading" className="text-xl font-semibold">
            למה דווקא CityStrata
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            באירועי פינוי רחבי היקף, קבלת ההחלטות תלויה בגיאוגרפיה, בתשתיות
            ובצרכים של משקי הבית. CityStrata מסייעת לרשויות ולמשפחות לשלב בין נתונים
            מרחביים לפרופילים מובנים, לצורך תגובה מתואמת, יעילה ושקופה לכל הצדדים.
            </p>
          </section>

          <Separator className="bg-border" />

          <section aria-labelledby="capabilities-heading" className="space-y-6">
            <div>
              <h2 id="capabilities-heading" className="text-xl font-semibold">
                יכולות
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
              היכולות המרכזיות הזמינות במערכת.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="border-border shadow-card">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                      <Layers className="h-5 w-5" aria-hidden />
                    </span>
                    <CardTitle className="text-base">GIS ושכבות</CardTitle>
                  </div>
                  <CardDescription>
                    אזורים סטטיסטיים, מתקנים ושכבות מפה לניתוח ממוקד באילת.
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card className="border-border shadow-card">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                      <Users className="h-5 w-5" aria-hidden />
                    </span>
                    <CardTitle className="text-base">פרופילי משפחות</CardTitle>
                  </div>
                  <CardDescription>
                  ניהול מובנה של משפחות מפונות וקהילות, המשקף צרכים ואילוצים אמיתיים של משקי בית.
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card className="border-border shadow-card">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                      <Sparkles className="h-5 w-5" aria-hidden />
                    </span>
                    <CardTitle className="text-base">התאמה והמלצות</CardTitle>
                  </div>
                  <CardDescription>
                  המלצות מדורגות והכוונה טקטית המבוססות על פרופיל המשפחה וההקשר המרחבי.
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card className="border-border shadow-card">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                      <Bot className="h-5 w-5" aria-hidden />
                    </span>
                    <CardTitle className="text-base">סוכנים חכמים</CardTitle>
                  </div>
                  <CardDescription>
                    תהליכים אוטומטיים המסייעים בניתוח, מעקב וקבלת החלטות.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </section>

          <Separator className="bg-border" />

          <section aria-labelledby="how-heading" className="space-y-6">
            <h2 id="how-heading" className="text-xl font-semibold">
              איך זה עובד
            </h2>
            <ol className="grid gap-4 md:grid-cols-3">
              <li>
                <Card className="h-full border-border shadow-card">
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold">1 · קלט</CardTitle>
                    <CardDescription>
                      מזינים אזורי מיקוד גיאוגרפיים ונתוני פרופיל משפחה או קהילה.
                    </CardDescription>
                  </CardHeader>
                </Card>
              </li>
              <li>
                <Card className="h-full border-border shadow-card">
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold">2 · ניתוח</CardTitle>
                    <CardDescription>
                      משלבים שכבות GIS, כללים ותובנות מערכת ליצירת הקשר תפעולי.
                    </CardDescription>
                  </CardHeader>
                </Card>
              </li>
              <li>
                <Card className="h-full border-border shadow-card">
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold">3 · המלצה</CardTitle>
                    <CardDescription>
                      מציגים התאמות מעשיות וצעדים הבאים לצוותים ולמשפחות.
                    </CardDescription>
                  </CardHeader>
                </Card>
              </li>
            </ol>
          </section>

          <Separator className="bg-border" />

          <section aria-labelledby="preview-heading" className="space-y-4">
            <div>
              <h2 id="preview-heading" className="text-xl font-semibold">
                תצוגה מקדימה
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                המחשה בלבד - פתחו את המפה הראשית לשכבות וכלים בזמן אמת.
              </p>
            </div>
            <Card className="overflow-hidden border-border shadow-card">
              <CardContent className="p-5 pt-5">
                <div
                  className="relative aspect-[16/10] w-full overflow-hidden rounded-lg border border-border bg-muted/80 shadow-sm"
                  aria-hidden
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-muted via-background to-primary/10" />
                  <div className="absolute inset-0 opacity-[0.35] [background-image:linear-gradient(90deg,hsl(var(--border))_1px,transparent_1px),linear-gradient(hsl(var(--border))_1px,transparent_1px)] [background-size:40px_40px]" />
                  <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2">
                    <div className="rounded-full border-2 border-primary/50 bg-card p-3 shadow-md">
                      <Map className="h-10 w-10 text-primary" />
                    </div>
                    <span className="rounded-md border border-border bg-card/95 px-2 py-1 text-xs font-medium text-muted-foreground shadow-sm">
                      תצוגה סטטית
                    </span>
                  </div>
                  <div className="absolute bottom-3 left-3 right-3 rounded-md border border-border/80 bg-card/95 px-3 py-2 text-xs text-muted-foreground shadow-sm backdrop-blur-sm">
                    המפה האינטראקטיבית, האשכולות והפאנלים הצדדיים זמינים לאחר פתיחת
                    המפה הראשית.
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <Separator className="bg-border" />

          <section aria-labelledby="nav-heading" className="space-y-4">
            <h2 id="nav-heading" className="text-xl font-semibold">
              לאן ממשיכים
            </h2>
            <Card className="border-border shadow-card">
              <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <Button asChild variant="default" className="bg-primary text-primary-foreground hover:bg-primary/90">
                  <Link to="/map" className="gap-2">
                    פתיחת מפה
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/family">לוח בקרה משפחתי</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/municipality">לוח בקרה לרשות המקומית</Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link to="/login">התחברות</Link>
                </Button>
              </CardContent>
            </Card>
            <p className="text-xs text-muted-foreground">
            הגישה ללוחות הבקרה דורשת התחברות; במידת הצורך תועברו למסך ההתחברות.
            </p>
          </section>
        </div>

        <footer className="border-t border-border bg-card/60 px-4 py-10">
          <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">CityStrata</p>
              <p className="mt-1 text-xs text-muted-foreground">אילת · מערכת לניהול פינוי</p>
            </div>
            <nav className="flex flex-wrap gap-x-4 gap-y-2 text-sm" aria-label="קישורי תחתית">
              <Link to="/map" className="text-primary hover:underline">
                מפה
              </Link>
              <Link to="/family" className="text-primary hover:underline">
                משפחה
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
