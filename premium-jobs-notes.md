# Premium Jobs (Bubble) — Field Structure

## All Fields (from Bubble "Modify view" panel)
- Apply Direct? (boolean)
- Budget (text — e.g. "$18/hour", "Pitch your rate", "Dance Competition")
- Category (text — e.g. "Dance Competition", "Acrobatic Arts")
- Client-Company (relation → Client Company)
- Company (text — company name string)
- Description (rich text / long text)
- Email (text — contact email for applications)
- Featured (boolean)
- Interested_artists (list relation → Users)
- Link (text — external application link)
- Location (text)
- Logo (image)
- Service Type (text / relation)
- Status (text — e.g. Active, Closed)
- Tag (text)
- Work From Anywhere? (boolean)
- Created Date
- Modified Date
- Slug (text)
- Created By (relation → User)
- Unique id

## Key Differences vs Regular Jobs (requests table)
| Feature | Regular Job (request) | Premium/PRO Job |
|---|---|---|
| Scheduling | startDate, endDate, dateType | Not present — more open-ended |
| Rate | artistHourlyRate, clientHourlyRate, isHourly | Budget (free text) |
| Transport | transportation boolean | Not present |
| Ages | ages JSON array | Not present |
| Location | locationAddress + lat/lng | Location (text only) |
| Company | clientCompanyName on user | Company + Client-Company relation |
| Logo | profilePicture on user | Logo (dedicated field) |
| Apply method | Internal platform | Apply Direct? + Link + Email |
| Featured | isBoosted | Featured boolean |
| Work remote | Not present | Work From Anywhere? |
| Category | masterServiceTypeId | Category (free text) |
| Tag | Not present | Tag |
| Interested artists | interested_artists table | Interested_artists list on record |

## Confirmed API field names (from live Bubble API)
`Apply Direct?`, `Budget`, `Category`, `Client-Company`, `Company`, `Created By`, `Created Date`, `Description`, `Location`, `Modified Date`, `Service Type`, `Slug`, `Status`, `Tag`, `Work From Anywhere?`, `_id`, `email`, `featured`, `interested_artists`, `logo`

## Total records: 185 (live)

## Sample records visible:
1. On Stage America — Social Media Manager / Content Creator — Dance Competition — Apply Direct: yes
2. Thunderstruck Dance Competition — Judge for April 24-26 2026 — Dance Competition — Apply Direct: yes
3. Turn It Up Dance Challenge — Judge replacement — Dance Competition — Apply Direct: yes
4. Acrobatic Arts — Dance Curriculum Business Development Assistant — $18/hour — Acrobatic Arts category
