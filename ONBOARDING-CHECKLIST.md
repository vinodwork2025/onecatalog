# Client onboarding checklist

Tick every box before you mark the job done and collect the balance.
Anyone on your team can run this. Nothing here is optional.

**Client:** ______________________  **Slug:** ______________________
**Date started:** ____________  **Plan:** annual / lite / monthly

---

## 1. Before you build (day 0)

- [ ] ₹999 booking amount received
- [ ] Slug agreed and written down. Short, lowercase, no hyphens if possible.
- [ ] Photos received on WhatsApp
- [ ] Business name, tagline, address, phone, hours, years in business collected
- [ ] Logo received (or noted that there isn't one)
- [ ] Brand colour picked from their logo or shop board
- [ ] Product names, categories and prices received

---

## 2. Build (day 1)

- [ ] `node scripts/new-client.js <slug> "<Name>" <whatsapp>`
- [ ] Photos moved into `raw/<slug>/`
- [ ] `node scripts/photos.js <slug>` run, output checked by eye
- [ ] Low-res or badly cropped photos flagged and re-requested
- [ ] Sheet tab created, named exactly `<slug>`, rows filled
- [ ] Sheet published to web as CSV, link in `config.json`
- [ ] `config.json` complete: address, hours, since, about, theme, accent
- [ ] `node scripts/build.js <slug>` passes with no warnings
- [ ] Previewed on an actual phone, not just the laptop
- [ ] Every WhatsApp button tested — does the pre-filled message name the product?
- [ ] Pushed to GitHub, live link loads

---

## 3. Client approval (day 2)

- [ ] Link sent on WhatsApp
- [ ] Client has seen it and approved
- [ ] Corrections done
- [ ] **Balance collected**

---

## 4. Handover call (same day, 15 minutes, video or in person)

Do these yourself on their phone. Do not send instructions and hope.

- [ ] **WhatsApp Business → Profile → Website field** — link pasted
- [ ] **Greeting message** set:
      _"Thanks for reaching out to [Name]. See our full catalog here: [link].
      Tell us what you're looking for and we'll send prices."_
- [ ] **Quick reply `/catalog`** created with the link
- [ ] **Quick reply `/price`** and `/address` created
- [ ] Showed them how to post the link as a **WhatsApp Status**
- [ ] **Google Business Profile → Website field** — link added (you do this)
- [ ] Instagram / Facebook bio link updated
- [ ] Share card image sent to them (logo + "Full Catalog" + link)
- [ ] 60-second screen recording of the above sent to them

---

## 5. Domain (₹3,999 plan only)

- [ ] Domain bought in the client's name
- [ ] `customDomain` set in `config.json`
- [ ] Domain added in Cloudflare Pages → Custom domains
- [ ] Rebuilt and pushed
- [ ] Subdomain redirects to the custom domain — tested
- [ ] Domain renewal date noted in your tracker

---

## 6. Day 7 check-in

- [ ] Messaged: _"How many times have you sent the link this week?"_
- [ ] If the answer is "not yet" — redo the handover. A client who never shares
      the link will never renew.
- [ ] Asked for any new products to add

---

## 7. Day 60 upsell conversation

- [ ] One-page report sent: catalog views, WhatsApp enquiries
- [ ] Asked: _"Are you showing up when people search for [their category] in
      [their town]?"_
- [ ] GBP + local SEO pitched at ₹8,000/month
- [ ] Outcome logged: interested / not now / no

---

## Tracker fields to keep per client

Slug · Business name · Owner name · WhatsApp · Plan · Amount paid · Start date ·
Renewal date · Domain · Domain renewal date · Updates used (of 12) ·
Day-7 done · Day-60 upsell outcome · Telecaller
