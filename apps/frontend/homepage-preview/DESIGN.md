# ChronicCare AI homepage preview

The Arabic homepage introduces a health record for everyday use at home and before a doctor visit. A full-bleed portrait opens the page. An example week, three routine disclosures, and a doctor-visit section follow in that order.

## Visual system

- `preview.css` owns the preview tokens. Warm paper `#f8f7f1`, forest ink `#192d25`, lime `#e0f3ab`, sage `#e2e9da`, and lavender `#eeedf5` define the light theme. Dark mode maps the same roles to darker green and lavender surfaces and keeps the lime action.
- The existing Cairo variable face serves Arabic display and body text. Use display weight 800, body weight 500, and higher weights on controls. Keep Latin brand text and measurement values left-to-right.
- Primary and outlined buttons share a pill shape, 52px baseline height, and bold Arabic label. Keyboard focus uses a 3px ring. The routine uses native disclosures, and the readings selector uses native radio behavior.
- The sample week is fictional. The plotted series and screen-reader table use the same values. The solid and dashed series distinguish the two types of pressure readings.
- The hero uses a still photo. Anchor navigation and short control transitions respect the reduced-motion preference.

## Review URL

Run the existing Vite development server and open `/homepage-preview/`. Append `?theme=dark` or `?theme=light` to open a particular theme. The entry lives alongside the default Vite entry. Its account links use the existing login and registration routes.

## Photography

- Hero portrait by Kari Alfonso via [Pexels](https://www.pexels.com/photo/portrait-of-senior-woman-sitting-by-window-36830823/).
- At-home blood pressure photo by Yaroslav Shuraev via [Pexels](https://www.pexels.com/photo/adult-woman-checking-the-digital-blood-pressure-monitor-8088856/). The preview uses the app’s existing image file.
- Consultation photo by Vitaly Gariev via [Pexels](https://www.pexels.com/photo/doctor-and-patient-consultation-in-modern-office-39192354/).

All three photos are used under the [Pexels license](https://www.pexels.com/license/).
