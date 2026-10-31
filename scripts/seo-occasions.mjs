/* Content for the occasion landing pages (/occasions/<slug>).
   `occasion` must match a booking-page occasion so "Book" pre-selects it. */

export const SITE_URL = 'https://www.blackpearl.social';

export const occasionPages = [
  {
    slug: 'proposal-yacht-mumbai',
    occasion: 'Proposals',
    navLabel: 'Yacht Proposals',
    title: 'Private Yacht Proposal in Mumbai | Black Pearl · Lady Alice',
    description: 'Plan a private sunset proposal on Lady Alice in Mumbai harbour. The whole yacht is yours, with decor, dinner and photos arranged by our team. Check live dates.',
    kicker: 'Proposals',
    h1: 'A Private Yacht Proposal in Mumbai',
    image: 'proposal-sunset.jpg',
    imageAlt: 'Sunset proposal set up on the bow of Lady Alice in Mumbai harbour',
    intro: [
      'Ask the question on open water, with Mumbai\'s skyline turning gold behind you and nobody else on board but the people you choose.',
      'Lady Alice is booked by one party at a time, so the bow, the decks and the crew are yours for the whole charter. Our team helps you plan the setup, the music, the dinner and the moment itself.'
    ],
    highlights: [
      'A private bow set up for two, or the whole yacht for family and friends to join after the yes',
      'Sunset timing on the evening slot (2 pm – 11 pm)',
      'Florals, candles, dinner and a photographer arranged by our team on request',
      'Quiet waters on the outskirts of the harbour, away from the crowds'
    ],
    recommended: { slot: 'evening', hours: 3, note: 'Most proposals choose a 3-hour evening charter timed for sunset.' },
    faqs: [
      ['Can we keep the proposal a surprise?', 'Yes. Book under your name, share the plan with our team on WhatsApp, and we coordinate the setup so your partner sees it only when you arrive on deck.'],
      ['Can family join after the proposal?', 'Yes. Lady Alice takes up to 100 guests, so many couples invite family and friends to come out of hiding for a celebration once the ring is on.'],
      ['When is the best time for a proposal?', 'The evening slot runs from 2 pm to 11 pm. A start around sunset gives you golden light for the moment and the city lights afterwards.']
    ],
    related: ['engagement-ceremony-yacht-mumbai', 'anniversary-dinner-yacht-mumbai', 'pre-wedding-shoot-yacht-mumbai']
  },
  {
    slug: 'birthday-party-yacht-mumbai',
    occasion: 'Birthday parties',
    navLabel: 'Birthday Parties',
    title: 'Birthday Party on a Yacht in Mumbai | Black Pearl · Lady Alice',
    description: 'Host a private birthday party on Lady Alice in Mumbai for up to 100 guests. Music, food, cake and decor handled by our team. Check live dates.',
    kicker: 'Birthdays',
    h1: 'Birthday Party on a Private Yacht in Mumbai',
    image: 'birthday-party.jpg',
    imageAlt: 'Milestone birthday celebration on the deck of Lady Alice',
    intro: [
      'Turn a milestone birthday into a night at sea. Lady Alice hosts up to 100 guests across her open decks, with the whole yacht reserved for your party alone.',
      'Bring the cake, the playlist and the people. Our team handles catering, decor and the timeline so you can enjoy the evening with your guests.'
    ],
    highlights: [
      'Room for up to 100 guests, from close friends to the whole family',
      'Sound and a DJ console on deck for the party',
      'Catering from our partner kitchens, or your own caterer by arrangement',
      'Day or evening slots, for 3, 5 or 6 hours'
    ],
    recommended: { slot: 'evening', hours: 5, note: 'Most birthday parties choose a 5-hour evening charter: sunset, dinner and dancing.' },
    faqs: [
      ['How many guests can come to a birthday party on board?', 'Lady Alice takes up to 100 guests, and the whole yacht is reserved for your party.'],
      ['Can we bring our own cake and decorations?', 'Yes. Share your plans with our team on WhatsApp and we coordinate the setup before you board.'],
      ['Is alcohol allowed at a birthday party on the yacht?', 'Yes, through our beverage packages or your own sealed bottles under a temporary FL-4 liquor permit, which our team helps you get.']
    ],
    related: ['private-yacht-party-mumbai', 'bachelorette-party-yacht-mumbai', 'family-celebration-yacht-mumbai']
  },
  {
    slug: 'corporate-event-yacht-mumbai',
    occasion: 'Corporate events',
    navLabel: 'Corporate Events',
    title: 'Corporate Event & Offsite Yacht in Mumbai | Black Pearl · Lady Alice',
    description: 'Book Lady Alice for corporate offsites, client dinners, team parties and brand launches in Mumbai. Up to 100 guests, fully private. Check live availability.',
    kicker: 'Corporate',
    h1: 'Corporate Events on a Private Yacht in Mumbai',
    image: 'corporate-gala.jpg',
    imageAlt: 'Corporate gala evening on board Lady Alice',
    intro: [
      'Take the team, your clients or a product launch out of the conference room. Lady Alice gives you a private venue on the water for up to 100 guests.',
      'Use the morning slot for a leadership offsite or the evening for a gala dinner or launch. Our team plans the run of show, catering and AV with you.'
    ],
    highlights: [
      'Leadership offsites, town halls, client dinners and team celebrations',
      'Brand launches and showcases with space for a stage or runway',
      'Morning (6 am – 2 pm) and evening (2 pm – 11 pm) slots',
      'One booking at a time, so your guests never share the yacht'
    ],
    recommended: { slot: 'day', hours: 5, note: 'Offsites usually take a 5-hour day charter; galas and launches suit the evening.' },
    faqs: [
      ['How many people can attend a corporate event on Lady Alice?', 'Up to 100 guests, with the whole yacht reserved for your company.'],
      ['Can we host a brand launch or product showcase on board?', 'Yes. The open decks can be set up for a launch, a runway or a presentation. Share your brief and our team plans the layout.'],
      ['Can we add our company branding on board?', 'Yes. Share your brief and our team plans the setup with you before the event.']
    ],
    related: ['private-yacht-party-mumbai', 'harbour-sailing-cruise-mumbai', 'birthday-party-yacht-mumbai']
  },
  {
    slug: 'anniversary-dinner-yacht-mumbai',
    occasion: 'Anniversaries & private dinners',
    navLabel: 'Anniversaries & Dinners',
    title: 'Anniversary & Private Dinner on a Yacht in Mumbai | Black Pearl',
    description: 'Celebrate an anniversary with a candlelit private dinner on Lady Alice in Mumbai harbour. The whole yacht, just for you. Check live dates.',
    kicker: 'Anniversaries & Dinners',
    h1: 'Anniversary Dinner on a Private Yacht in Mumbai',
    image: 'private-dining.jpg',
    imageAlt: 'Candlelit private dinner table on the deck of Lady Alice',
    intro: [
      'Celebrate the years together with a candlelit table on deck, the sea around you and the city lights in the distance.',
      'Keep it to two, or invite the family for a dinner they will remember. Our team plans the menu, the music and the table with you.'
    ],
    highlights: [
      'A candlelit table on deck, set for two or for the whole family',
      'Menus planned with our partner kitchens',
      'Sunset and night views over Mumbai harbour',
      'The whole yacht reserved for you, with no other guests on board'
    ],
    recommended: { slot: 'evening', hours: 3, note: 'An evening 3-hour charter fits dinner at sunset; choose 5 hours for a bigger family celebration.' },
    faqs: [
      ['Can we book the yacht just for two people?', 'Yes. Lady Alice is booked as a whole yacht, so a dinner for two gets the same privacy as a party for 100.'],
      ['Can you arrange a custom menu?', 'Yes. Our team plans the menu with our partner kitchens, or you can bring your preferred caterer by arrangement.'],
      ['What time does the evening charter start?', 'Evening charters run between 2 pm and 11 pm. You pick a 3, 5 or 6-hour window on the booking page.']
    ],
    related: ['proposal-yacht-mumbai', 'engagement-ceremony-yacht-mumbai', 'family-celebration-yacht-mumbai']
  },
  {
    slug: 'engagement-ceremony-yacht-mumbai',
    occasion: 'Engagements',
    navLabel: 'Engagement Ceremonies',
    title: 'Engagement & Ring Ceremony on a Yacht in Mumbai | Black Pearl',
    description: 'Host your engagement or ring ceremony on Lady Alice in Mumbai for up to 100 guests. Florals, catering and setup planned with you. Check live dates.',
    kicker: 'Engagements',
    h1: 'Engagement & Ring Ceremony on a Yacht in Mumbai',
    image: 'engagement-ceremony.jpg',
    imageAlt: 'Ring ceremony with floral setup on the deck of Lady Alice',
    intro: [
      'Bring both families together on the water. Exchange rings under a floral setup on deck, then celebrate with dinner and music as the sun goes down.',
      'Lady Alice hosts up to 100 guests and is reserved for one party at a time, so your ceremony stays private from start to finish.'
    ],
    highlights: [
      'Space for both families, up to 100 guests',
      'Floral installations and a ceremony setup arranged by our team',
      'Catering with live stations or a plated dinner',
      'A master suite on board for getting ready'
    ],
    recommended: { slot: 'evening', hours: 5, note: 'Ring ceremonies usually take 5 hours in the evening: ceremony, dinner and celebration.' },
    faqs: [
      ['How many guests can we invite to an engagement on the yacht?', 'Up to 100 guests, with the whole yacht reserved for your families.'],
      ['Can we do traditional rituals on board?', 'Yes. Tell our team what the ceremony needs and we plan the setup around it.'],
      ['Is there a room to get ready on board?', 'Yes, Lady Alice has a master suite that the couple can use before the ceremony.']
    ],
    related: ['proposal-yacht-mumbai', 'pre-wedding-shoot-yacht-mumbai', 'family-celebration-yacht-mumbai']
  },
  {
    slug: 'bachelorette-party-yacht-mumbai',
    occasion: 'Bachelor & bachelorette nights',
    navLabel: 'Bachelor & Bachelorette',
    title: 'Bachelorette & Bachelor Party Yacht in Mumbai | Black Pearl',
    description: 'Throw a bachelorette or bachelor party on a private yacht in Mumbai. Music, drinks and the whole deck for your crew. Check live dates.',
    kicker: 'Bachelor & Bachelorette',
    h1: 'Bachelorette & Bachelor Parties on a Yacht in Mumbai',
    image: 'bachelorette-party.jpg',
    imageAlt: 'Bachelorette party celebrating on the deck of Lady Alice',
    intro: [
      'Give the bride or groom a send-off at sea. Music on deck, drinks with a view and the whole yacht for your group.',
      'Our team helps with decor, food and the playlist so you can focus on the party.'
    ],
    highlights: [
      'The whole yacht for your group, with no strangers on board',
      'Sound and a DJ console on deck',
      'Decor, food and drinks arranged on request',
      'Day or evening charters for 3, 5 or 6 hours'
    ],
    recommended: { slot: 'evening', hours: 3, note: 'Most groups choose a 3-hour evening charter; take 5 hours for a full party night.' },
    faqs: [
      ['Can we play our own music?', 'Yes. There is a DJ console on deck. Bring your playlist or your own DJ.'],
      ['Can we bring alcohol?', 'Yes, through our beverage packages or your own sealed bottles under a temporary FL-4 liquor permit, which our team helps you arrange.'],
      ['Is there a minimum group size?', 'No. The whole yacht is yours, whether you bring 10 friends or 100.']
    ],
    related: ['private-yacht-party-mumbai', 'birthday-party-yacht-mumbai', 'harbour-sailing-cruise-mumbai']
  },
  {
    slug: 'pre-wedding-shoot-yacht-mumbai',
    occasion: 'Pre-wedding & photo shoots',
    navLabel: 'Pre-Wedding Shoots',
    title: 'Pre-Wedding & Photo Shoot on a Yacht in Mumbai | Black Pearl',
    description: 'Book Lady Alice for a pre-wedding shoot or photo and video shoot in Mumbai. Golden-hour light, open decks and a master suite. Check live dates.',
    kicker: 'Pre-Wedding & Shoots',
    h1: 'Pre-Wedding & Photo Shoots on a Yacht in Mumbai',
    image: 'master-suite.jpg',
    imageAlt: 'Master suite on Lady Alice used for pre-wedding shoots',
    intro: [
      'Shoot on open decks, the bow and a styled master suite, with the sea and Mumbai\'s skyline as your backdrop.',
      'Book the morning for soft light or the evening for golden hour and the city at night. The yacht is yours alone for the shoot.'
    ],
    highlights: [
      'Bow, open decks, lounge deck and a master suite to shoot in',
      'Golden-hour light on the evening slot, soft light in the morning',
      'Room for your photographer, stylist and crew',
      'No other guests on board during your charter'
    ],
    recommended: { slot: 'day', hours: 3, note: 'A 3-hour charter usually covers a pre-wedding shoot; pick the evening for sunset frames.' },
    faqs: [
      ['Can we bring our own photographer and crew?', 'Yes. Your photographer, videographer and stylist are welcome on board.'],
      ['Which slot has the best light?', 'The evening slot (2 pm – 11 pm) covers golden hour and sunset. The day slot (6 am – 2 pm) gives soft morning light.'],
      ['Can we shoot inside the yacht?', 'Yes. The master suite and lounge areas are available to shoot in during your charter.']
    ],
    related: ['proposal-yacht-mumbai', 'engagement-ceremony-yacht-mumbai', 'harbour-sailing-cruise-mumbai']
  },
  {
    slug: 'private-yacht-party-mumbai',
    occasion: 'Private parties',
    navLabel: 'Private Parties',
    title: 'Private Yacht Party in Mumbai for up to 100 Guests | Black Pearl',
    description: 'Host a private yacht party in Mumbai on Lady Alice. Cocktails, DJ nights and celebrations for up to 100 guests, the whole yacht yours. Check live dates.',
    kicker: 'Private Parties',
    h1: 'Private Yacht Parties in Mumbai',
    image: 'cocktail-party.jpg',
    imageAlt: 'Cocktail party with DJ console on the deck of Lady Alice',
    intro: [
      'Cocktail evenings, DJ nights and celebrations for no reason at all. Lady Alice gives you a private party venue on the water for up to 100 guests.',
      'The yacht is booked by one party at a time. Our team handles food, drinks and setup so you can host.'
    ],
    highlights: [
      'Up to 100 guests across open decks',
      'DJ console and sound on deck',
      'Bar service with our beverage packages, or your own bottles under an FL-4 permit',
      'Evening charters through to 11 pm'
    ],
    recommended: { slot: 'evening', hours: 5, note: 'Most parties take a 5-hour evening charter; the longest option is 6 hours.' },
    faqs: [
      ['How late can a yacht party go?', 'Evening charters can run until 11 pm, the end of venue hours at sea.'],
      ['Do we share the yacht with other groups?', 'No. Lady Alice takes one booking at a time, for up to 100 guests.'],
      ['Where do guests board?', 'Guests board at Jetty No. 2, Princess Ferry Wharf (Bhaucha Dhakka), Mazgaon, Mumbai.']
    ],
    related: ['birthday-party-yacht-mumbai', 'bachelorette-party-yacht-mumbai', 'corporate-event-yacht-mumbai']
  },
  {
    slug: 'family-celebration-yacht-mumbai',
    occasion: 'Family celebrations',
    navLabel: 'Family Celebrations',
    title: 'Family Celebration on a Private Yacht in Mumbai | Black Pearl',
    description: 'Gather the whole family on Lady Alice for reunions, milestone anniversaries and festive get-togethers in Mumbai. Up to 100 guests. Check live dates.',
    kicker: 'Family Celebrations',
    h1: 'Family Celebrations on a Private Yacht in Mumbai',
    image: 'family-reunion.jpg',
    imageAlt: 'Family celebration on the deck of Lady Alice',
    intro: [
      'Reunions, parents\' anniversaries, homecomings and festivals: bring every generation together on the water for a day they will talk about for years.',
      'There is space for up to 100 guests and a team that plans the food and setup with you.'
    ],
    highlights: [
      'Up to 100 guests, from grandparents to kids',
      'Day or evening charters for 3, 5 or 6 hours',
      'Catering planned around your family\'s preferences',
      'The whole yacht reserved for your family'
    ],
    recommended: { slot: 'day', hours: 5, note: 'Families often choose a 5-hour charter; take the evening for sunset and city lights.' },
    faqs: [
      ['Is the yacht suitable for children and elderly guests?', 'Yes. Let our team know who is coming and we plan seating and boarding with you.'],
      ['Can we bring vegetarian or Jain food?', 'Yes. Menus are planned with you, and you may also bring your own caterer by arrangement.'],
      ['How do we get to the boarding point?', 'Guests board at Jetty No. 2, Princess Ferry Wharf (Bhaucha Dhakka), Mazgaon, near Dockyard Road station on the Harbour Line.']
    ],
    related: ['anniversary-dinner-yacht-mumbai', 'birthday-party-yacht-mumbai', 'harbour-sailing-cruise-mumbai']
  },
  {
    slug: 'harbour-sailing-cruise-mumbai',
    occasion: 'Coastal sailing cruises',
    navLabel: 'Harbour Sailing Cruises',
    title: 'Private Harbour Sailing Cruise in Mumbai | Black Pearl · Lady Alice',
    description: 'Charter Lady Alice for a private sailing cruise around Mumbai harbour. Sail, then drop anchor in quiet waters. 3, 5 or 6 hours. Check live dates.',
    kicker: 'Harbour Sailing',
    h1: 'Private Sailing Cruises Around Mumbai Harbour',
    image: 'sailing-cruise.jpg',
    imageAlt: 'Lady Alice sailing across Mumbai harbour',
    intro: [
      'Sail out of Princess Ferry Wharf into the quieter waters on the outskirts of Mumbai harbour, then drop anchor and enjoy the view.',
      'Every charter mixes time sailing with time at anchor, and the yacht is yours alone for the trip.'
    ],
    highlights: [
      'A 3, 5 or 6-hour charter with sailing and anchored time',
      'Morning cruises from 6 am or evening cruises until 11 pm',
      'Up to 100 guests on board',
      'Boarding at Jetty No. 2, Princess Ferry Wharf'
    ],
    recommended: { slot: 'evening', hours: 3, note: 'A 3-hour evening cruise covers sunset; the 6-hour charter splits evenly between sailing and anchor.' },
    faqs: [
      ['How much of the charter is spent sailing?', 'A 3-hour charter has 1 hour sailing and 2 at anchor, 5 hours has 1.5 sailing and 3.5 at anchor, and 6 hours has 3 of each.'],
      ['Where does the cruise go?', 'Lady Alice heads out to quieter waters on the outskirts of the harbour, away from the busy jetties.'],
      ['What are the cruise timings?', 'Venue hours at sea are 6 am to 11 pm, with a day slot (6 am – 2 pm) and an evening slot (2 pm – 11 pm).']
    ],
    related: ['private-yacht-party-mumbai', 'family-celebration-yacht-mumbai', 'proposal-yacht-mumbai']
  }
];
