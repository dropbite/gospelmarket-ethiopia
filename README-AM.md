# GospelMarket Ethiopia

የክርስቲያን ምርቶች marketplace የመጀመሪያ ስሪት (MVP)።

## ያሉት
- ምርቶችን ማየትና መፈለግ
- ሻጭ መመዝገብ/መግባት
- ሻጭ ምርት ማስገባትና መሰረዝ
- ምርት ከመታየቱ በፊት አስተዳዳሪ ማጽደቅ
- ገዢ የትዕዛዝ ጥያቄ ማስገባት
- PostgreSQL ዳታቤዝ

## Android + GitHub + Render ማስጀመር
1. GitHub.com በChrome ክፈትና `gospelmarket-ethiopia` የሚባል repository ፍጠር።
2. ZIP ፋይሉን አውርድና Extract/Unzip አድርግ።
3. በGitHub repository ውስጥ `Add file` → `Upload files` በመጫን ከZIP የወጡትን ፋይሎች ሁሉ ጫን። `public` አቃፊው ከ`server.js` እና `package.json` ጋር መኖር አለበት።
4. Render.com ክፈት፣ GitHub አገናኝ፣ `New` → `Blueprint` ምረጥና repository ምረጥ። `render.yaml` የweb service እና PostgreSQL ዳታቤዝ ይፈጥራል።
5. Render ሲጠይቅ `ADMIN_EMAIL` የራስህን email አስገባ። ይህን ከመጀመሪያ ምዝገባህ በፊት አድርግ። `JWT_SECRET` በRender የሚፈጠረውን እንዳለ ተወው።
6. Deploy ከተጠናቀቀ በኋላ Render የሰጠህን URL ክፈት። በ`ADMIN_EMAIL` የገለጽከውን email ተጠቅመህ መለያ ፍጠር፤ የአስተዳዳሪ ፓነል ይታይሃል።
7. ሌሎች ሻጮች ይመዝገቡና ምርት ያስገቡ፤ ከአስተዳዳሪ ማጽደቅ በኋላ ይታያል።

## ገና ያልተጨመሩ
የቀጥታ ክፍያ (Telebirr/Chapa/CBE), ምስል ማስጫኛ, የኢሜይል ማረጋገጫ, የይለፍ ቃል መመለሻ, ለሻጭ የትዕዛዝ ማሳወቂያ እና የግላዊነት/የአገልግሎት ውሎች ገና አልተጨመሩም። ከህዝብ ጋር በቀጥታ ከመጠቀም በፊት የደህንነት ምርመራ ያድርጉ። የትዕዛዝ ጥያቄዎች የግል መረጃ ይይዛሉ።
