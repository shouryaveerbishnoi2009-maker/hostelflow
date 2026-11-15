# HostelFlow: Phase-wise Figma Prompts

## How to use this
1. Paste the **Master Brief** first, in a fresh Figma Make / Figma AI file. It sets the design language.
2. Then paste **one phase at a time**. Wait for it to finish, check it, and only then move to the next. Each phase repeats the key rules, so it still works if the tool forgets earlier context.
3. If a screen looks too "AI-ish" (too symmetric, too glowy, too purple), paste the **Humanising Pass** at the end.

---

## What I checked and changed in your design (read this, it affects the prompts)

**Mismatches between your files**
- The Synopsis text tables and the draw.io ER diagram agree with each other. The *picture* inside the Synopsis PDF (with CROWD_SLOT, RECOMMENDATION, DISH, LAUNDRY_TRANSACTION, email, section) is an older version. I built the UI from the **current** design: HOSTEL, STUDENT, MEAL_TYPE, MESS_MENU, MESS_VISIT, LAUNDRY_BAG, LAUNDRY_REQUEST. Fix or replace that old image before submission, because an examiner will notice.
- In the draw.io file, MESS_VISIT's key is labelled `mess id`. It should be `visit_id` (INT), matching the Synopsis. Also, MESS_VISIT has no `student_id` / `meal_id` FK attributes drawn, and LAUNDRY_BAG has no `student_id`. These should be added to the diagram.
- `mess_exit_time` in MESS_VISIT is an *expected* value computed at entry. The UI must label it "Expected exit" and never "Exited at".

**Improvements I made (the UI needs these to actually work)**
1. **Crowd and best-time are computed, not stored.** The old design had CROWD_SLOT and RECOMMENDATION tables. The current one correctly drops them. The UI calculates 15-minute slot occupancy from entry and expected exit times.
2. **Closed state.** A scan outside 8-9, 12-14 or 20-22 can't be given a meal type. I added a friendly "Mess is closed right now" screen with the next opening time.
3. **Duplicate-scan guard.** A second scan during the same meal shows "You're already checked in".
4. **Laundry status values.** Your `status` column is VARCHAR(10) and the Synopsis only names SUBMITTED and WASHING. I used **SUBMITTED, WASHING, READY, RECEIVED** (all 10 characters or fewer). If you choose different values, tell me and I'll adjust.
5. **Two extra roles.** The admin dashboard (your objective 7) and someone who changes laundry status need a login. I added **Admin** and **Laundry Staff** views. These need a small USER/role field at build time (a note, not a new ER entity, unless you want one).
6. **Laundry queue is visible.** Showing "bags ahead" at submission is the core idea of your 4.4 formula, so it becomes a visual queue.
7. **Cafeteria is excluded**, as your Synopsis says.

**Assumptions I made (change if wrong)**
- Hostel names are placeholders (Block A, Block B...). Student sample names are Indian, since this is JKLU.
- Buffer time is 5 minutes.
- Student app is mobile-first (the QR scan happens on a phone). Admin and Staff are desktop.

---

## MASTER BRIEF (paste first)

```
You are designing the complete front end for "HostelFlow", a Smart Hostel Time & Crowd Management System for a university in India (JK Lakshmipat University). Students scan a QR code at the mess entrance; the system logs the visit, detects the meal automatically, estimates how long they'll be inside, and recommends the least crowded time to eat. It also tracks laundry bags and gives a realistic return date based on how many bags are ahead in the queue.

PLATFORMS
- Student app: mobile-first, 390x844 frames.
- Admin dashboard and Laundry Staff console: desktop, 1440x900 frames.

DESIGN LANGUAGE: warm, calm, slightly imperfect. It must look like a small team of students and a designer built it by hand, NOT like an AI template.
- Palette: warm paper background #F5F0E6, ink green #1F3A2E (primary text and buttons), terracotta #D9643A (accent, used sparingly), saffron #E8A93B (busy / warning), sage #8FAE8B (quiet / good), soft clay #C9B8A3 (borders, muted). Dark surfaces use #16241D, not pure black.
- Typography: Fraunces (soft serif) for headings and big numbers; Instrument Sans or DM Sans for body; JetBrains Mono only for times and IDs. Real hierarchy with generous size contrast, and a few sentence-case headings that feel like a person wrote them.
- Glass / transparency, used GENTLY and only on: bottom navigation, floating cards over coloured backgrounds, sheets and modals, and the top bar on scroll. Recipe: white at 45-60% opacity, background blur 16-24px, 1px inner border white at 60%, very soft shadow (0 8 30 rgba(31,58,46,0.08)). Behind glass there must be 2-3 large, soft, slow-moving blurred colour blobs (terracotta, sage, saffron at 25-35% opacity). Never make everything glass.
- Shape: mix of radii (20px cards, 999px pills, 12px inputs). Slightly asymmetric layouts, with some cards offset or different heights. No perfectly uniform 3-column grids of identical cards.
- Icons: one consistent outline set (Lucide or Phosphor, 1.75px stroke). No emoji as icons. A small hand-drawn squiggle underline or circle accent is allowed on one key word per screen.
- Copy: friendly, specific, human. For example "Dinner is usually busiest 8:00-8:15, try 8:30 instead." Never "Optimize your experience". No lorem ipsum, ever; use realistic sample data.
- Avoid: purple-blue gradients, neon glow, glowing orbs, floating 3D shapes, stock-illustration people, generic "dashboard card with icon in a coloured circle" repeated everywhere, centered hero text with a gradient headline.

MOTION (gentle, purposeful, 200-450ms, ease-out or soft spring; no bounce)
- Screen transitions: Smart Animate with a 12px upward slide plus fade.
- Lists and cards: stagger in by 40ms each.
- Numbers count up once on first view.
- Bar charts grow from the baseline with a 30ms stagger.
- Buttons: 2% scale-down on press, soft shadow lift on hover.
- Background blobs drift very slowly (20-30s loops).
- Respect "reduce motion": provide static variants.

COMPONENTS to build once and reuse: Button (primary / secondary / ghost), Pill/Chip, Input, GlassCard, SolidCard, BottomNav (4 tabs), TopBar, CrowdBar, StatusBadge, ProgressTrack, Toast, Sheet, EmptyState. Build them as Figma components with variants and auto layout. Use variables for colours, radii and spacing (4px base grid).

DATA MODEL the UI must reflect exactly (do not invent other entities):
HOSTEL(hostel_id, hostel_name) -> STUDENT(student_id, roll_no, name, room_no, phone, hostel_id)
MEAL_TYPE(meal_id, meal_type, standard_start_time, standard_end_time, avg_eating_time_minutes): Breakfast 08:00-09:00, Lunch 12:00-14:00, Dinner 20:00-22:00
MESS_MENU(menu_id, meal_id, day_of_week, dish_name, expected_prep_time_minutes): exactly one dish per day per meal
MESS_VISIT(visit_id, student_id, meal_id, visit_date, mess_entry_time, mess_exit_time [EXPECTED, auto-computed])
LAUNDRY_BAG(bag_number, student_id): one bag per student, permanent
LAUNDRY_REQUEST(request_id, bag_number, submitted_datetime, expected_return_datetime, actual_received_datetime, status [SUBMITTED / WASHING / READY / RECEIVED], bags_ahead_at_submission)

Formulas to show in the UI:
expected_exit = entry + dish prep minutes + average eating minutes + 5 min buffer
expected_return = submitted + average turnaround + (bags_ahead x average minutes per bag)

Confirm you understand, then wait for Phase 0.
```

---

## PHASE 0: Foundations and design system

```
Phase 0 of HostelFlow. Using the Master Brief, build the design foundation only. No app screens yet.

Create:
1. Colour variables (light theme) with the exact hex values from the brief, plus semantic names: surface, surface-glass, text-primary, text-muted, accent, busy, quiet, border.
2. Text styles: Display (Fraunces 40/44), H1 (Fraunces 28/34), H2 (Fraunces 22/28), Body (Instrument Sans 16/24), Small (14/20), Caption (12/16), Mono-time (JetBrains Mono 15/20).
3. Spacing scale on a 4px grid, and radius tokens (12, 20, 28, 999).
4. Effects: glass-light, glass-strong, shadow-soft, shadow-lift.
5. Components with variants and auto layout: Button, Chip, Input, GlassCard, SolidCard, BottomNav (Home, Mess, Laundry, Me), TopBar, CrowdBar (states: quiet, moderate, busy, recommended), StatusBadge (SUBMITTED, WASHING, READY, RECEIVED), ProgressTrack, Toast, Sheet, EmptyState.
6. One style-guide frame showing everything on the warm paper background with the soft blurred blobs behind a couple of glass samples, so I can judge the transparency.

Keep it restrained: warm, calm, no glow, no purple. Components should look slightly hand-made, with subtle asymmetry in the card shadows and a single squiggle accent in the style guide.
```

---

## PHASE 1: Onboarding, login and Student Home

```
Phase 1 of HostelFlow (student app, 390x844). Use the design system from Phase 0.

Screens:
1. Splash: the "HostelFlow" wordmark in Fraunces, a small hand-drawn arrow-and-clock mark, and slow drifting colour blobs. 1.2s, then fades to Login.
2. Login: roll number field plus a 6-digit OTP sent to the registered phone (no password). Friendly line: "Use your roll number, we'll text you a code." Include a small role switch link at the bottom: "I'm staff / admin".
3. First-time setup (shown once): confirm name, hostel (dropdown from HOSTEL), room number, phone. This maps to STUDENT. Auto-fill name and roll number from the sample record "Shouryaveer Bishnoi, 2025BTECH111, Block A, Room 214".
4. Student Home (the key screen). Top: a personal greeting that changes by time of day ("Good evening, Shouryaveer"). Then, in this order:
   - A large "Right now" card (glass over blobs): current meal in progress or the next one, with a live mess crowd level (Quiet / Moderate / Busy) and a one-line recommendation.
   - A "Best time to eat dinner" strip with the recommended 15-minute slot highlighted in terracotta. This leads to Phase 3.
   - A laundry mini-card: bag number plus status plus expected return, or "No bag in wash".
   - A "Today's menu" row: Breakfast, Lunch and Dinner dishes with prep time.
   - A floating glass bottom nav with a prominent centre "Scan" button in terracotta.
Make the home screen layout intentionally uneven (one wide card, one narrow card, one overlapping element), not a perfect grid.

Prototype: Splash -> Login -> OTP -> First-time setup -> Home. Add the stagger-in animation on Home cards and the count-up on the crowd percentage.
```

---

## PHASE 2: QR scan, auto meal detection and visit confirmation

```
Phase 2 of HostelFlow (student app, 390x844). This is the core automation flow: one scan, nothing else.

Screens and states:
1. Scan screen: camera viewfinder with a rounded frame, corner brackets that gently pulse, a dim overlay, and a glass hint pill: "Point at the QR outside the mess". A small torch toggle.
2. Success / Visit confirmed (the hero screen). The meal type is detected automatically and shown as a big heading, e.g. "Dinner, you're in." Show:
   - Entry time (mono), e.g. 8:07 PM
   - Today's dish from MESS_MENU, e.g. "Aloo Paratha", with prep time "~6 min to serve"
   - Average eating time for this meal, e.g. "~15 min"
   - Fixed buffer "+5 min"
   - A neat calculation line: 8:07 + 6 + 15 + 5 = **Expected exit 8:33 PM**
   - A line saying "No need to scan out, we've worked it out for you."
   - A progress ring around the expected duration that fills slowly.
   - A button "Done" and a ghost button "View my visits".
3. Closed state: scan attempted outside 8-9 AM, 12-2 PM, 8-10 PM. Friendly copy: "The mess isn't serving right now. Lunch opens at 12:00 PM." Show the next opening and the three meal windows as pills.
4. Already checked in: "You're already in for dinner, expected exit 8:33 PM."
5. Scan error: unreadable QR, with a "Try again" button and a manual "Enter mess code" fallback.

Animations: a ripple from the scan point on success, the checkmark drawn as a stroke, the calculation line revealing term by term (200ms apart), the ring filling.

Make the success screen feel warm and a little celebratory without confetti.
```

---

## PHASE 3: Best time to visit the mess (crowd intelligence)

```
Phase 3 of HostelFlow (student app, 390x844). This is the headline feature: tell the student when to go.

Screen: "Best time to eat".
- Top segmented control: Breakfast / Lunch / Dinner (auto-select the upcoming meal) and a day selector for Today / Tomorrow-typical.
- A hero recommendation card (glass): "Recommended: 8:30 - 8:45 PM. Usually less crowded." with a small terracotta squiggle under the time.
- A 15-minute-slot bar chart for the whole meal window. For dinner that's 8:00-10:00 PM, which is 8 slots. Each bar is a CrowdBar showing average students present, computed from entry and expected exit times. Colours: sage for quiet, saffron for moderate, terracotta for busy. The recommended slot gets an outline and a small star-less tag "Best". The current time is a thin vertical marker.
- Tapping a bar opens a bottom Sheet: slot time, average students, historical wait, and the dish served that day with its effect on speed ("Aloo paratha is prepared to order, so it moves slower than roti.").
- A second card: "Busiest right now vs best later" with the difference in minutes saved, e.g. "Go at 8:30 instead of 8:00 and save about 12 min".
- Footnote in Caption style: "Based on the last 30 days of mess visits."
- Empty state for a new hostel with too little data: "Still learning. Check back after a few days of visits."

Animation: bars grow from baseline with a 30ms stagger; switching meal re-animates; the sheet slides up with glass blur.

Do not use any robot/AI/sparkle iconography. The recommendation should read like a helpful friend's note.
```

---

## PHASE 4: Mess menu

```
Phase 4 of HostelFlow (student app, 390x844).

Screen: "This week's menu".
- A horizontal day strip (Mon-Sun) with today pre-selected and slightly raised.
- For the selected day, three meal blocks (Breakfast, Lunch, Dinner), each showing exactly ONE dish (one dish per day per meal, per MESS_MENU), the meal window time, and an "expected serving time" pill such as "~6 min" or "~1 min".
- Make the difference visible: a thin horizontal "speed" line under each dish, short for fast dishes like roti, longer for slow ones like aloo paratha, with text "Slower to serve" / "Quick".
- A tiny pattern note linking to Phase 3: "Heavier dishes tend to mean longer queues" with an arrow to Best time to eat.
- Sample week (use realistic dishes): Mon Dinner Aloo Paratha (6 min), Tue Dinner Roti (1 min), Wed Dinner Rajma Chawal (3 min), Thu Dinner Puri Sabzi (5 min), Fri Dinner Veg Biryani (4 min), Sat Dinner Chole Bhature (6 min), Sun Dinner Paneer + Roti (2 min). Fill breakfast and lunch similarly.

Layout: not a table. Use an editorial, slightly uneven card stack. Day change should cross-fade the meal blocks with a small slide.
```

---

## PHASE 5: Laundry (student)

```
Phase 5 of HostelFlow (student app, 390x844).

Screens:
1. Laundry home: shows the student's permanent bag number (e.g. "Bag B-214") as a tag-like label, as if on a physical bag. Below it, the current request or "No bag in the wash right now" with a primary button "Submit my bag".
2. Submit confirmation (Sheet): when tapped, show the queue snapshot: "7 bags are ahead of yours" (bags_ahead_at_submission). Show the calculation transparently: Submitted Wed 10 Oct 3:20 PM + typical turnaround 36 h + (7 x 20 min) = **Expected back Fri 10 Oct, around 6:00 AM**. Provide a Confirm button. (Use sensible realistic dates.)
3. Active request tracker: a horizontal ProgressTrack with four steps: Submitted -> Washing -> Ready -> Received. The current step is highlighted. A "bags ahead now" live counter, and the ORIGINAL estimate stays visible with the text "Your first estimate: Fri 6:00 AM" alongside a live "Now: on track / running ~2 h late".
4. Ready state: a warm banner "Your bag is ready at the laundry room." plus a button "I've collected it" which sets RECEIVED and records the actual received time.
5. History list: past requests with submitted, expected and actual dates, and an "On time / Late by 3 h" chip. Calculate lateness by comparing expected_return_datetime to actual_received_datetime.

Visual idea: the bag number label has a slightly rotated, paper-tag look; the queue is shown as a row of small bag silhouettes with the student's bag highlighted at its position. Bags move forward one step with a smooth slide when the number ahead decreases.
```

---

## PHASE 6: Visit history and profile

```
Phase 6 of HostelFlow (student app, 390x844).

Screens:
1. "My visits": a timeline grouped by date. Each row: meal name, time in, expected exit (labelled "Expected exit"), dish. A small monthly summary at top ("23 meals this month, usually dinner around 8:10 PM") written in plain language, and a mini calendar heat strip.
2. Me / Profile: name, roll no, hostel, room, phone (STUDENT fields). An "Edit room" action. Notification preferences (toggle styles only: "Tell me when my laundry is ready"). Logout.
3. Empty state for first-time users with a gentle line drawing of a plate.

Keep the tone friendly. Use glass only on the top bar when scrolling.
```

---

## PHASE 7: Admin dashboard (desktop)

```
Phase 7 of HostelFlow (admin, 1440x900). Objective: show hostel administration usage, crowd levels and laundry workload.

Layout: a slim left sidebar (Overview, Mess crowd, Menu manager, Laundry, Students, Settings), a top bar with the hostel selector (HOSTEL) and date range. Sidebar uses glass over a soft blob background; the content area is warm paper.

Overview screen, designed with an editorial hierarchy, NOT a row of identical KPI cards:
- One big headline stat in Fraunces ("1,184 mess visits this week, up 6%") with a small sparkline.
- A "Peak hours" heatmap (days x 15-minute slots) in sage-to-terracotta, hoverable.
- "Busiest and quietest slots" two-column list with exact times.
- "Dish impact" chart: average queue/occupancy per dish, showing that heavier dishes create longer occupancy.
- Laundry workload: bags currently SUBMITTED, WASHING, READY, with average turnaround and on-time percentage.
- An "Attention needed" list in plain language, e.g. "Dinner 8:00-8:15 runs at 2.1x average. Consider another serving counter."

Other screens: Mess crowd (full slot analysis with date filter), Menu manager (a weekly grid to edit dish_name and expected_prep_time_minutes, one dish per meal per day, with validation showing the effect on expected exit time), Laundry overview table, Students list (search by roll number).

Interactions: hover tooltips, chart transitions on filter change (300ms), table row hover lift, drawer for student detail.
```

---

## PHASE 8: Laundry Staff console (desktop)

```
Phase 8 of HostelFlow (staff, 1440x900). A simple, fast screen for the person running the laundry.

- Left: queue list in submission order. Each row: bag number, student name, hostel/room, submitted time, status badge, expected return.
- Right: detail panel for the selected bag with big status buttons to move it forward: Submitted -> Washing -> Ready. "Mark received" appears only after Ready and records actual_received_datetime.
- A "Scan or type bag number" input at the top to jump straight to a bag.
- A live counter: "7 bags ahead of the next one".
- Bulk action: select several bags and set them to Washing.
- Make the controls large, high contrast, and forgiving: confirm toast with an Undo for 5 seconds.

Keep it much plainer than the admin dashboard: less glass, more clarity, because it's used during busy work.
```

---

## PHASE 9: Prototype wiring, motion and handoff

```
Phase 9 of HostelFlow. Connect and polish everything built so far.

1. Wire prototype flows:
   - Student: Splash -> Login -> OTP -> Setup -> Home -> Scan -> Visit confirmed -> Home.
   - Student: Home -> Best time to eat -> tap a bar -> Sheet.
   - Student: Home -> Laundry -> Submit -> Confirm -> Tracker -> Ready -> Received.
   - Student: Scan outside meal hours -> Closed state; scan twice -> Already checked in.
   - Admin: Overview -> Mess crowd -> Menu manager -> edit a dish.
   - Staff: select bag -> change status -> Undo toast.
2. Apply the motion rules from the Master Brief with Smart Animate. Add a "reduced motion" variant of the main flow.
3. Add dark theme variants for the student app (backgrounds #16241D, the same accents slightly desaturated, glass at 12-18% white).
4. Check accessibility: text contrast AA on glass areas (add a subtle solid scrim behind small text if needed), 44px minimum touch targets, and never use colour alone for crowd levels (add labels like "Quiet", "Busy").
5. Tidy up: consistent layer names, auto layout everywhere, a Components page, and a short "Developer notes" frame listing which data field each UI value comes from (e.g. "Expected exit = mess_exit_time, computed").
```

---

## HUMANISING PASS (paste if it looks too "AI-made")

```
Review all screens and make them feel designed by a person:
- Break perfect symmetry: vary card sizes, offset a few elements by 4-12px, let one element overlap its container edge.
- Reduce glow, gradients and shadows by half; remove any purple/blue tint.
- Cut the number of rounded icon-circles; use plain icons or typography instead.
- Replace generic headings with specific, conversational ones.
- Use real data everywhere (names like Shouryaveer, Raghuraj, Ananya; times like 8:07 PM; dishes like Aloo Paratha). No "John Doe", no "Lorem ipsum", no round numbers like 100%.
- Limit the accent colour (terracotta) to one primary action and one highlight per screen.
- Add exactly one small hand-drawn detail per major screen (squiggle underline, paper-tag label, circled time).
- Keep glass to at most two surfaces per screen.
- Make sure animation is subtle: nothing moves faster than 200ms or slower than 450ms, except the background blobs.
```

---

## Tips
- Figma Make has input limits, so if a phase is too long, paste the first half, then say "continue with the rest of this phase" and paste the remainder.
- Always paste the **Master Brief again** if you open a new chat or file.
- Fix the ER diagram issues listed at the top before you submit, so the UI, ER diagram and Synopsis all agree.
