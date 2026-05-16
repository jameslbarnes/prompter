// Example data extracted from server.js
// This is used for demo/testing purposes

const EXAMPLE_RESUME = `Sarah Bennett
 📍 Nashville, TN | 📞 (555) 123-4567 | ✉️ sarah.bennett@email.com | 💼 LinkedIn.com/in/sarahbmarketing

Professional Summary
Strategic and passionate Marketing Manager with 15+ years of experience driving brand growth, customer engagement, and revenue through innovative campaigns and cross-functional leadership. Known for creative problem-solving, multitasking under pressure, and building high-performing teams. Adept at managing multiple projects and stakeholders, though currently seeking better balance between professional excellence and personal well-being.

Core Competencies
Strategic Marketing Planning

Team Leadership & Mentoring

Integrated Campaign Development

Budget Management

Digital Marketing & SEO

Brand Management

CRM & Email Marketing

Data Analysis & Reporting

Time Management (…working on it!)

Professional Experience
Marketing Manager
 BrightPoint Solutions, Nashville, TN
 2015 – Present
Lead a team of 7 in developing and executing integrated marketing strategies across digital and traditional platforms.

Increased qualified lead generation by 38% through targeted content strategy and marketing automation.

Collaborate cross-functionally with Sales, Product, and Customer Success teams to align messaging and goals.

Manage a $500K annual budget, optimizing spend for maximum ROI.

Spearheaded rebranding initiative that boosted customer retention by 22%.

Known as the "go-to" person for urgent tasks and last-minute fixes (…sometimes to a fault).

Recently juggling 60+ emails/day and multiple overlapping deadlines—actively working on sustainable systems to restore balance.

Senior Marketing Specialist
 UrbanTech Media, Atlanta, GA
 2010 – 2015
Developed B2B campaigns that increased website traffic by 45% and supported national account growth.

Oversaw trade show and event marketing, coordinating logistics, branding, and promotional materials.

Mentored junior team members, many of whom were promoted to managerial roles.

Often volunteered for after-hours tasks, demonstrating dedication—though now learning to set healthier boundaries.

Marketing Coordinator
 Vibe Communications, Charlotte, NC
 2005 – 2010
Created social media content calendars and managed vendor relationships.

Assisted in launching two award-winning campaigns for regional clients.

Supported senior marketers in data tracking and campaign analysis.

Education
B.A. in Communications & Marketing
 University of North Carolina, Chapel Hill
 Graduated 2005

Certifications & Skills
Google Ads Certified

HubSpot Inbound Marketing

Adobe Creative Suite

Project Management Tools: Asana, Trello, Slack

Volunteer Work
PTA Marketing Chair – Local Elementary School
 Social Media Manager – Women in Business Nashville Chapter

Personal Note
While I'm proud of my professional accomplishments, I'm currently exploring strategies to rebalance my workload and strengthen my mental well-being. I believe in doing great work without burning out—and I'm learning that productivity and peace can (and should) go hand in hand.
`;

const EXAMPLE_QA = [
    {
        question: "Your resume mentions you've spearheaded a rebranding initiative that boosted customer retention by 22%. Could you tell me the story behind that project?",
        answer: "That rebranding project was definitely a career highlight. The biggest challenge was that we were dealing with a 20-year-old brand that had strong recognition but was starting to feel outdated. Some executives were resistant to change, worried we'd lose brand equity. I had to build consensus by presenting market research showing how our competitors were evolving while we stayed static. I created a phased approach rather than a complete overnight change, which helped ease the transition. We started with refreshing our digital presence, then gradually rolled out new messaging, updated our visual identity, and finally launched a major campaign around our new positioning. The key was balancing between honoring our history while making the brand relevant for today's market. What made it successful was involving stakeholders from different departments early on, especially customer success teams who had direct feedback from clients. Seeing that 22% increase in retention validated all the late nights and heated discussions!"
    },
    {
        question: "Those late nights you mentioned - I noticed you also mentioned in your resume that you're seeking better balance between professional excellence and personal well-being. What's driving that search for balance right now?",
        answer: "It's become increasingly unsustainable. I'm currently juggling 60+ emails daily and multiple overlapping deadlines. I've always been known as the 'go-to person' for urgent tasks, which was initially flattering but has become overwhelming. After those long days managing crises and putting out fires, I come home completely drained. I barely have energy for my family, and I find myself answering emails at 11 PM instead of being present with my husband. To be honest, I also feel unsupported at home - the mental load of managing our household and schedules falls mostly on me, which compounds the work stress. My sleep is suffering, I've had some health issues flare up, and I recently missed my daughter's soccer tournament because of a last-minute work emergency. That was a wake-up call that something needs to change."
    },
    {
        question: "That sounds incredibly challenging, juggling both work demands and home responsibilities. What specific strategies have you started implementing to create more sustainable systems in both areas?",
        answer: "I'm still very much a work in progress with this, but I've started implementing some changes that are helping. First, I've created email filters and templates for common requests, which saves me at least an hour daily. I've also started blocking focused work time on my calendar where I'm actually turning off notifications completely. That was really hard at first—I kept worrying I was missing something urgent. The biggest change has been learning to delegate more effectively. I realized I was creating a bottleneck by wanting to approve everything from my team. Now I've established clearer guidelines for what decisions they can make independently, which has been liberating for all of us. I'm experimenting with a technique where I only check emails three times a day instead of constantly. And honestly, the hardest but most important thing I'm working on is setting boundaries at home too—creating dedicated family time where work devices stay in another room. My husband and I are having more conversations about sharing household responsibilities more evenly. Some days are better than others, but I'm starting to see that the world doesn't fall apart if I'm not immediately responsive 24/7."
    },
    {
        question: "I love that you're working on delegation - that's so important. Speaking of developing others, I see you've mentored several team members who advanced to managerial roles. Could you share how your own leadership approach has evolved as you've focused more on sustainability?",
        answer: "My leadership approach has done a complete 180 over the years. When I first became a manager, I thought leading meant having all the answers and being available 24/7. I unintentionally created a culture where my team felt they needed to match my unhealthy work habits. Now I realize that was more about my insecurity as a leader than actual effectiveness. Today, I'm much more focused on outcomes rather than hours worked. I've become explicit about not expecting email responses after hours or on weekends, and I model this by using email scheduling tools to send my own non-urgent messages during business hours, even if I'm working late. I've instituted 'Focus Fridays' where we block the afternoon for deep work without meetings. We've also created a more collaborative planning process where the team helps set realistic timelines for projects, building in buffer time for unexpected issues. One practice that's been particularly effective is what we call 'success sharing'—highlighting team members who found smart, efficient ways to achieve goals, not just those who put in the most hours. Has it affected our results? Actually, our performance metrics have improved. Our team's creative output is stronger, we're retaining talent better, and people seem more engaged. The biggest challenge has been managing upward—helping more traditional executives understand that sustainable pace leads to better long-term results than burnout-inducing sprints. I'm not perfect at this balance yet, but I'm committed to creating an environment where people can do their best work without sacrificing their wellbeing."
    },
    {
        question: "That's fascinating how better boundaries have actually improved results. Can you tell me about a specific mentoring relationship where you helped someone develop while also encouraging healthier work patterns?",
        answer: "There's one relationship that really stands out. When I was at UrbanTech, we hired this young woman named Kelsey right out of college. She was incredibly bright but also very quiet and hesitant to share her ideas in meetings. I noticed that in one-on-one settings, she had these brilliant creative concepts, but they never made it to the broader team. Instead of just telling her to speak up more—which rarely works—I started creating specific opportunities for her to present in smaller settings. I'd ask her to lead portions of internal meetings first, then gradually client-facing ones. We would prep together, and I'd give her feedback. What really changed things was when I asked her to lead a pitch for a smaller client. She knocked it out of the park, and that success gave her the confidence boost she needed. Within two years, she was managing her own team and accounts. But here's the thing - I also noticed she was adopting my old habits of working until 9 PM every night and never taking breaks. So I started deliberately scheduling our check-ins during normal hours, talking openly about how I was learning to prioritize and set boundaries, and asking about her interests outside of work. I made a point of acknowledging her accomplishments without tying them to the excessive hours. Watching her develop into a confident leader who also maintains healthy boundaries has been incredibly rewarding. She's now a marketing director at a great company in Atlanta, and we still check in regularly. She recently told me that the most valuable thing she learned from me wasn't the marketing strategies but the permission to be ambitious without sacrificing her wellbeing."
    },
    {
        question: "It's powerful how you're redefining success beyond just the marketing metrics. Can you tell me about a specific mentoring relationship where you helped someone develop while also encouraging healthier work patterns?",
        answer: "There's one relationship that really stands out. When I was at UrbanTech, we hired this young woman named Kelsey right out of college. She was incredibly bright but also very quiet and hesitant to share her ideas in meetings. I noticed that in one-on-one settings, she had these brilliant creative concepts, but they never made it to the broader team. Instead of just telling her to speak up more—which rarely works—I started creating specific opportunities for her to present in smaller settings. I'd ask her to lead portions of internal meetings first, then gradually client-facing ones. We would prep together, and I'd give her feedback. What really changed things was when I asked her to lead a pitch for a smaller client. She knocked it out of the park, and that success gave her the confidence boost she needed. Within two years, she was managing her own team and accounts. But here's the thing - I also noticed she was adopting my old habits of working until 9 PM every night and never taking breaks. So I started deliberately scheduling our check-ins during normal hours, talking openly about how I was learning to prioritize and set boundaries, and asking about her interests outside of work. I made a point of acknowledging her accomplishments without tying them to the excessive hours. Watching her develop into a confident leader who also maintains healthy boundaries has been incredibly rewarding. She's now a marketing director at a great company in Atlanta, and we still check in regularly. She recently told me that the most valuable thing she learned from me wasn't the marketing strategies but the permission to be ambitious without sacrificing her wellbeing."
    },
    {
        question: "It's powerful how you're redefining success beyond just the marketing metrics. Speaking of change, you've navigated significant shifts in marketing over your 15+ year career. What do you see as the next major transformation that marketers need to prepare for?",
        answer: "Everyone's talking about AI in marketing, but honestly, I think we're heading down a dangerous path. I've spent my career believing in the human element of marketing - the intuition, creativity, and emotional intelligence that no algorithm can replicate. This AI push feels like another tech fad that sacrifices what makes marketing special. At BrightPoint, I've been actively resisting the pressure to adopt these systems. I still maintain a physical idea board with sticky notes and magazine clippings for inspiration - my team laughs, but those tactile brainstorming sessions produce our best ideas. I've seen too many companies chase technology only to lose their soul in the process. Remember when everyone rushed to automate social media posts? That was a disaster for authentic engagement. I'm deeply concerned about what happens to creative professionals when companies replace them with chatbots. My best campaigns have always come from human connection - actually talking to customers face-to-face, not analyzing algorithmic patterns. Last month, our competitor released an AI-generated campaign that was technically flawless but completely soulless. I keep a file folder - yes, an actual manila folder - of these 'AI fails' to remind my team why human judgment matters. The marketers who will thrive are those who protect and champion what makes us human, not those who surrender to silicon overlords. I worry we're creating a world where marketing loses its heart. My assistant keeps trying to get me to use digital calendar apps, but my paper planner has never crashed or needed a software update."
    },
    {
        question: "That's an insightful perspective on AI. Have you found any ways that technology might actually help with the work-life balance challenges you mentioned earlier?",
        answer: "Not really, and I think that's another tech industry myth we need to stop perpetuating. Every 'time-saving' technology I've encountered has actually made my work-life balance worse, not better. Remember when email was supposed to make communication more efficient? Now we're all drowning in 24/7 messages. I've actively removed most apps from my phone because each notification was another intrusion into my personal time. My most successful strategy has been implementing 'analog Fridays' where our team uses no digital tools - just paper, conversations, and actual human connection. Those are consistently our most productive and creative days. The tech evangelists might mock me, but I still print important documents to review them properly - I catch errors on paper that I miss on screens. I've banned laptops from half our meetings because people were hiding behind screens instead of engaging. I have a strict no-devices rule at my dinner table, and my family reconnected in ways I never expected. Look, my colleague installed some AI email management system and spent three weekends troubleshooting it. Meanwhile, I developed a simple folder system and trained my assistant on how to prioritize messages. The real solutions to work-life balance are human ones: having honest conversations with my boss about workload, teaching my team clear communication, and actually talking to my husband about sharing household responsibilities. The most freeing decision I made was turning off my work email on my personal phone. Everyone panicked, but guess what? No emergencies went unaddressed. I keep a landline at home that only family has the number to. My kids joke that I'm stuck in the 90s, but I sleep better now than I have in years. Technology promises convenience but delivers dependency."
    },
    {
        question: "Looking back at your career journey and the challenges you've navigated, what do you wish you had known earlier that might help other marketing professionals avoid the burnout path?",
        answer: "I wish I had understood earlier that marketing effectiveness isn't about perfectionism or constant availability—it's about strategic focus and sustainable effort. I spent years trying to do everything perfectly, answering emails at midnight, and making myself available for every crisis. I thought that's what commitment looked like. But that approach led to diminishing returns and nearly burned me out multiple times. What I've learned is that marketing is a marathon, not a sprint. The most valuable thing I can offer as a marketer isn't my willingness to work 24/7—it's my clear thinking, creativity, and strategic perspective, all of which suffer when I'm exhausted. For emerging professionals, I'd say focus on developing systems that help you prioritize high-impact work instead of just being busy. Learn to distinguish between what feels urgent and what's truly important. Build relationships across departments so you understand business objectives beyond marketing metrics. And perhaps most importantly, establish boundaries early—it's much harder to pull back once you've set expectations of constant availability. The marketers who thrive long-term aren't necessarily the ones who work the most hours; they're the ones who consistently apply clear thinking to evolving challenges. If I had understood that my worth wasn't tied to constant availability, I would have structured my career differently from the beginning. Marketing will always be demanding, but sustainability matters. If I could go back, I'd tell my younger self that my career is a long game, and pacing matters as much as passion."
    }
];

const EXAMPLE_FIRST_NAME = "Sarah";

module.exports = {
    EXAMPLE_RESUME,
    EXAMPLE_QA,
    EXAMPLE_FIRST_NAME
};