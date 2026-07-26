// ─── CONSTANTS ───────────────────────────────────────────────────────────────

export const STRIPE_MONTHLY  = "#subscribe-monthly";
export const STRIPE_ANNUAL   = "#subscribe-annual";
export const FREE_PLAN_LIMIT = 1;

export const CATEGORIES = [
  { id:"business",      label:"Grow My Business",    tagline:"Revenue, offers, clients, and growth strategy",      detail:"The most common starting point. Choose this if you want more clients, better pricing, or consistent revenue.",    accent:"#B0728A", num:"01", rec:true  },
  { id:"visibility",    label:"Build Visibility",    tagline:"Brand presence, content, and market positioning",    detail:"Start here if you are doing strong work but the right people do not know you exist yet.",                      accent:"#8B7BAE", num:"02", rec:false },
  { id:"opportunities", label:"Find Opportunities",  tagline:"Speaking, partnerships, and strategic openings",     detail:"The right choice if you are ready to expand through collaboration, media, or strategic alliances.",          accent:"#6A9E8A", num:"03", rec:false },
  { id:"career",        label:"Advance My Career",   tagline:"Leadership, promotion, and professional growth",     detail:"Ideal if you are navigating a transition, seeking a promotion, or building strategic influence.",             accent:"#B8936A", num:"04", rec:false },
  { id:"networking",    label:"Expand My Network",   tagline:"Strategic relationships and meaningful connections",  detail:"Choose this if your next breakthrough depends on who you know and who knows you.",                          accent:"#7A8FA6", num:"05", rec:false },
];

export const INDUSTRIES = [
  "Real Estate","Beauty & Aesthetics","Wellness & Fitness","Legal","Photography",
  "Videography & Film","Content Creation","Marketing & Advertising","Public Relations",
  "Retail & E-Commerce","Restaurant & Food","Consulting","Coaching","Media & Journalism",
  "Education","Healthcare","Finance & Accounting","Technology","Nonprofit","Other",
];

export const STAGES = [
  { id:"starting",    label:"Just Getting Started",           sub:"No consistent clients, income, or packaged offer yet." },
  { id:"growing",     label:"Growing & Building Momentum",    sub:"Some progress, but growth or revenue is still inconsistent." },
  { id:"established", label:"Established & Looking to Scale", sub:"Proven work or demand — ready to expand." },
  { id:"optimizing",  label:"Experienced & Optimizing",       sub:"Focused on refinement, systems, profitability, or a new chapter." },
];

export const WEEK_THEMES = ["Foundation","Momentum","Activation","Scale & Review"];

// ─── INDUSTRY HUB DATA ───────────────────────────────────────────────────────

export const HUB_CATEGORIES = [
  {
    id: "entrepreneurship",
    label: "Entrepreneurship & Small Business",
    description: "Starting, growing, and running your own business.",
    icon: "◈",
    questions: [
      { id:"e1", title:"How do I get my first paying clients?", description:"Practical steps to land your first customers when starting from zero.", question:"I am just starting my business and need my first paying clients. My business is {context}. What are the most direct and practical steps I can take in the next 30 days to land my first customers?" },
      { id:"e2", title:"How do I price my offer?", description:"Figure out what to charge without undervaluing your work.", question:"I am struggling with pricing my offer. {context}. How do I figure out the right price? What factors should I consider, and how do I avoid charging too little?" },
      { id:"e3", title:"How do I make my revenue more consistent?", description:"Move from unpredictable income to steady monthly revenue.", question:"My revenue is inconsistent — some months are good and others are slow. {context}. What specific changes can I make to build more predictable, consistent income?" },
      { id:"e4", title:"Should I niche down or stay broad?", description:"Decide whether to specialize or keep your offer wide.", question:"I am trying to decide whether to niche down to a specific client type or stay broad. {context}. What are the real tradeoffs, and how do I know which direction is right for me right now?" },
      { id:"e5", title:"How do I get referrals without feeling awkward?", description:"Build a referral system that feels natural and works.", question:"I rely on word of mouth but do not have a system for getting referrals. {context}. What is the most natural and effective way to ask for referrals and build a referral system?" },
      { id:"e6", title:"How do I raise my prices without losing clients?", description:"Increase your rates while keeping the clients you value.", question:"I know I am undercharging but I am afraid of losing clients if I raise my prices. {context}. How do I raise my prices strategically without damaging my client relationships?" },
      { id:"e7", title:"When should I hire help?", description:"Know when to bring on support and what kind to look for.", question:"I am doing everything myself and feeling overwhelmed. {context}. How do I know when it is time to hire help, what kind of help to hire first, and how to afford it?" },
      { id:"e8", title:"How do I stop being the bottleneck in my business?", description:"Create systems so the business does not depend entirely on you.", question:"Everything in my business runs through me and I cannot scale. {context}. What are the most important systems I should build to reduce my personal involvement in day-to-day operations?" },
      { id:"e9", title:"How do I build a simple sales process?", description:"Create a repeatable way to convert leads into clients.", question:"I do not have a clear sales process — I just wing every conversation. {context}. What does a simple, effective sales process look like for my type of business?" },
      { id:"e10", title:"How do I handle a slow season?", description:"Strategies to generate revenue when business is slow.", question:"My business has slow seasons and I do not know how to handle them. {context}. What are the most effective ways to generate revenue or prepare during slow periods?" },
      { id:"e11", title:"Should I offer packages or hourly rates?", description:"Decide the best structure for pricing your services.", question:"I am trying to decide between charging by the hour or offering packages. {context}. What are the pros and cons of each, and which makes more sense for my situation?" },
      { id:"e12", title:"How do I handle a difficult client?", description:"Navigate challenging client relationships professionally.", question:"I have a difficult client situation I am not sure how to handle. {context}. What is the most professional and effective way to address this?" },
      { id:"e13", title:"How do I build my reputation from scratch?", description:"Establish credibility when you are new to your market.", question:"I am new to my market and have no track record or testimonials yet. {context}. What is the fastest and most effective way to build a credible reputation?" },
      { id:"e14", title:"How do I separate my personal and business finances?", description:"Set up the financial foundation for a real business.", question:"My personal and business finances are mixed together. {context}. What are the most important steps I should take to separate them and set up a proper financial structure?" },
      { id:"e15", title:"How do I stay motivated when growth is slow?", description:"Maintain momentum when results are not coming quickly.", question:"I am working hard but growth is slow and I am starting to doubt myself. {context}. What are realistic strategies to stay motivated and maintain momentum during slow periods?" },
    ]
  },
  {
    id: "corporate",
    label: "Corporate & Leadership",
    description: "Advancing your career, leading teams, and building influence.",
    icon: "◇",
    questions: [
      { id:"c1", title:"How do I get promoted?", description:"Position yourself for the next step in your career.", question:"I want to get promoted but I am not sure what it actually takes at my company. {context}. What are the most important things I need to demonstrate, and how do I make sure the right people notice?" },
      { id:"c2", title:"How do I ask for a raise?", description:"Negotiate your salary with confidence and preparation.", question:"I believe I deserve a raise but I am nervous about asking. {context}. How do I prepare for this conversation, what should I say, and how do I handle pushback?" },
      { id:"c3", title:"How do I build visibility at work without self-promoting?", description:"Get noticed for your work in an authentic way.", question:"I do strong work but I feel invisible in my organization. {context}. How do I build internal visibility and get credit for my contributions without feeling like I am bragging?" },
      { id:"c4", title:"How do I manage up effectively?", description:"Build a productive relationship with your manager.", question:"My relationship with my manager is not working well. {context}. What does managing up effectively look like, and how do I improve this relationship?" },
      { id:"c5", title:"How do I lead a team I did not hire?", description:"Build trust and effectiveness with an inherited team.", question:"I was placed in charge of a team I did not hire and there are challenges. {context}. What is the most effective approach to building credibility and improving team performance?" },
      { id:"c6", title:"How do I handle a difficult colleague?", description:"Navigate a challenging working relationship professionally.", question:"I have a difficult relationship with a colleague that is affecting my work. {context}. What is the most professional and effective way to handle this situation?" },
      { id:"c7", title:"How do I transition into a leadership role?", description:"Make the shift from individual contributor to leader.", question:"I have recently moved into a leadership role or am about to. {context}. What are the most important mindset and behavior changes I need to make to be effective as a leader?" },
      { id:"c8", title:"How do I make my case for a new initiative?", description:"Pitch an idea or project to decision-makers effectively.", question:"I have an idea I want to bring to leadership but I am not sure how to make the case. {context}. How do I build a compelling pitch and get buy-in from decision-makers?" },
      { id:"c9", title:"How do I build strategic relationships at work?", description:"Develop the internal network that supports your growth.", question:"I know relationships matter for career growth but I am not sure how to build them strategically. {context}. What is the most effective approach to building meaningful professional relationships inside my organization?" },
      { id:"c10", title:"How do I handle being passed over for a promotion?", description:"Respond constructively and position yourself for the future.", question:"I was passed over for a promotion and I am trying to figure out what to do next. {context}. How do I process this professionally, understand what happened, and position myself better going forward?" },
      { id:"c11", title:"How do I become a thought leader in my field?", description:"Build a professional reputation beyond your current role.", question:"I want to be known as a thought leader in my industry but I am not sure where to start. {context}. What are the most effective ways to build a professional reputation and become recognized in my field?" },
      { id:"c12", title:"How do I transition to a different industry?", description:"Make a successful career pivot to a new field.", question:"I want to transition to a different industry but I am not sure how to make that move. {context}. What is the most realistic and effective path to making a successful career change?" },
      { id:"c13", title:"How do I deal with burnout?", description:"Recognize and recover from professional exhaustion.", question:"I am experiencing burnout and it is affecting my performance and wellbeing. {context}. What are practical strategies to recover from burnout while managing my professional responsibilities?" },
      { id:"c14", title:"How do I give difficult feedback?", description:"Deliver hard messages in a way that is heard and respected.", question:"I need to give feedback that might be difficult for someone to hear. {context}. How do I deliver this feedback in a way that is direct, constructive, and preserves the relationship?" },
      { id:"c15", title:"How do I build executive presence?", description:"Develop the confidence and credibility of a senior leader.", question:"I want to develop more executive presence but I am not sure what that actually means in practice. {context}. What specific behaviors, communication styles, and habits define executive presence and how do I develop them?" },
    ]
  },
  {
    id: "creative",
    label: "Creative & Media",
    description: "Building a creative career, audience, and sustainable income.",
    icon: "◉",
    questions: [
      { id:"cr1", title:"How do I turn my creative work into consistent income?", description:"Move from sporadic revenue to reliable creative earnings.", question:"I do creative work but my income is inconsistent. {context}. What are the most realistic and effective ways to build consistent revenue from my creative work?" },
      { id:"cr2", title:"How do I build an audience from scratch?", description:"Grow a real following for your creative work.", question:"I am starting from zero and trying to build an audience. {context}. What are the most effective strategies for building a genuine, engaged audience for my type of creative work?" },
      { id:"cr3", title:"How do I get brand partnerships?", description:"Land paid collaborations with brands in your space.", question:"I want to work with brands but I do not know how to get started. {context}. What do brands look for, how do I approach them, and what do I need to have in place before reaching out?" },
      { id:"cr4", title:"How do I price my creative services?", description:"Charge what your creative work is actually worth.", question:"I am struggling to price my creative services. {context}. How do I figure out what to charge, communicate my value, and stop undercharging for my work?" },
      { id:"cr5", title:"How do I deal with creative burnout?", description:"Recover your creative energy without losing momentum.", question:"I am experiencing creative burnout and it is affecting both my output and my income. {context}. What are practical ways to recover my creative energy while still maintaining professional commitments?" },
      { id:"cr6", title:"How do I diversify my income as a creative?", description:"Build multiple revenue streams from your creative skills.", question:"I rely on one income source and it feels risky. {context}. What are the most realistic ways for someone with my skills and platform to build multiple income streams?" },
      { id:"cr7", title:"How do I pitch myself to media?", description:"Get featured, interviewed, or covered by publications.", question:"I want to get media coverage or be featured in publications relevant to my work. {context}. How do I write a compelling pitch and get the attention of journalists and editors?" },
      { id:"cr8", title:"How do I create content consistently without burning out?", description:"Build a sustainable content creation system.", question:"I struggle to create content consistently. {context}. What does a sustainable content creation system look like for someone at my stage, and how do I build one?" },
      { id:"cr9", title:"How do I handle clients who undervalue creative work?", description:"Navigate clients who push back on your rates or process.", question:"I frequently encounter clients who do not understand or respect the value of creative work. {context}. How do I handle these conversations and work with clients who genuinely value what I do?" },
      { id:"cr10", title:"How do I protect my creative work legally?", description:"Understand the basics of copyright and contracts.", question:"I am not sure how to protect my creative work and ensure I am covered legally. {context}. What are the most important legal protections I should have in place as a creative professional?" },
      { id:"cr11", title:"How do I get speaking or event opportunities?", description:"Land speaking gigs that build your reputation and income.", question:"I want to speak at events or be invited to participate in panel discussions. {context}. How do I position myself for speaking opportunities and get my first invitations?" },
      { id:"cr12", title:"How do I transition from hobbyist to professional?", description:"Make the shift from creative passion to creative career.", question:"I am trying to transition my creative work from a hobby to a real professional career. {context}. What are the most important steps in making that transition successfully?" },
      { id:"cr13", title:"How do I grow beyond my current platform?", description:"Expand your reach to new audiences and channels.", question:"I have built an audience on one platform but I want to grow beyond it. {context}. What is the most effective strategy for expanding to new channels without spreading myself too thin?" },
      { id:"cr14", title:"How do I build a media kit?", description:"Create the professional materials brands and media need.", question:"I need to create a media kit but I am not sure what to include or how to present it. {context}. What should my media kit include and how do I make it compelling to brands and press?" },
      { id:"cr15", title:"How do I handle negative feedback on my work?", description:"Process criticism professionally without losing confidence.", question:"I received negative feedback on my work and I am struggling with how to handle it. {context}. What is the most constructive way to process criticism and decide what to do with it?" },
    ]
  },
  {
    id: "realestate",
    label: "Real Estate",
    description: "Growing your real estate business, clients, and reputation.",
    icon: "⬡",
    questions: [
      { id:"r1", title:"How do I get my first listings?", description:"Land your first seller clients as a new or growing agent.", question:"I am trying to get my first listings as a real estate agent. {context}. What are the most direct and effective strategies for getting sellers to choose me?" },
      { id:"r2", title:"How do I build a referral pipeline?", description:"Create a system where past clients send you new business.", question:"I want to build a steady stream of referrals but I do not have a system. {context}. What does an effective referral system look like for a real estate agent, and how do I build one?" },
      { id:"r3", title:"How do I stand out in a crowded market?", description:"Differentiate yourself from other agents in your area.", question:"There are many agents in my market and I struggle to stand out. {context}. What are the most effective ways to differentiate myself and become the obvious choice for a specific type of client?" },
      { id:"r4", title:"How do I build my online presence?", description:"Create a professional digital presence that generates leads.", question:"I need to build a stronger online presence. {context}. What are the most important online channels for real estate agents, and what kind of content actually generates leads?" },
      { id:"r5", title:"How do I convert leads into clients?", description:"Improve your process for turning inquiries into signed agreements.", question:"I get leads but struggle to convert them into actual clients. {context}. What are the most effective strategies for following up and converting leads into signed buyers or sellers?" },
      { id:"r6", title:"How do I break into the luxury market?", description:"Move upmarket to higher-priced properties and clients.", question:"I want to start working with luxury clients and higher-priced properties. {context}. What are the most realistic steps for breaking into the luxury market from where I currently am?" },
      { id:"r7", title:"How do I build a team?", description:"Hire and structure a real estate team that grows with you.", question:"I am thinking about building a team but I am not sure how to start. {context}. What are the most important considerations when building a real estate team and what should I do first?" },
      { id:"r8", title:"How do I generate leads without cold calling?", description:"Build a lead generation system that fits your personality.", question:"I do not want to rely on cold calling for leads. {context}. What are the most effective alternatives to cold calling for generating consistent real estate leads?" },
      { id:"r9", title:"How do I handle a difficult negotiation?", description:"Navigate tough deals with confidence and skill.", question:"I am facing a difficult negotiation in a current deal. {context}. What are effective negotiation strategies I can use in this situation?" },
      { id:"r10", title:"How do I manage my time as a solo agent?", description:"Stay productive and organized without a team.", question:"As a solo agent, I struggle to manage my time effectively. {context}. What systems and habits help solo real estate agents stay organized and productive?" },
      { id:"r11", title:"How do I become the go-to agent in my neighborhood?", description:"Dominate a specific geographic area or neighborhood.", question:"I want to become the recognized expert in a specific neighborhood. {context}. What is the most effective strategy for becoming the dominant agent in a particular area?" },
      { id:"r12", title:"How do I work with investors?", description:"Build relationships with real estate investors as clients.", question:"I want to start working with real estate investors. {context}. What do investors look for in an agent and how do I position myself to attract investor clients?" },
      { id:"r13", title:"How do I handle a slow market?", description:"Maintain business momentum when the market softens.", question:"The market in my area has slowed significantly. {context}. What strategies help real estate agents maintain momentum and income during a slow market?" },
      { id:"r14", title:"How do I ask for reviews and testimonials?", description:"Build a strong reputation through client feedback.", question:"I struggle to ask clients for reviews and testimonials. {context}. What is the most natural and effective way to ask for reviews, and how do I use them to attract new clients?" },
      { id:"r15", title:"How do I transition from buyer agent to listing agent?", description:"Shift your focus to representing sellers.", question:"I primarily work with buyers and want to transition to focusing on listings. {context}. What is the most effective strategy for making that shift?" },
    ]
  },
  {
    id: "finance",
    label: "Finance",
    description: "Building clients, credibility, and a sustainable practice.",
    icon: "◈",
    questions: [
      { id:"f1", title:"How do I build a client base from scratch?", description:"Attract your first clients as a financial professional.", question:"I am building my client base as a financial professional. {context}. What are the most effective strategies for attracting and landing my first clients?" },
      { id:"f2", title:"How do I differentiate myself from other advisors?", description:"Stand out in a crowded and competitive field.", question:"Many advisors offer similar services. {context}. How do I differentiate myself and become the clear choice for a specific type of client?" },
      { id:"f3", title:"How do I build trust with prospective clients?", description:"Establish credibility before the first meeting.", question:"Trust is everything in my field and I struggle to build it quickly. {context}. What are the most effective ways to build credibility and trust with people who do not know me yet?" },
      { id:"f4", title:"How do I get referrals from existing clients?", description:"Turn satisfied clients into a source of new business.", question:"I want to get more referrals from my existing clients. {context}. What is the most natural and effective way to build a referral culture in my practice?" },
      { id:"f5", title:"How do I move upmarket to higher-net-worth clients?", description:"Attract wealthier clients and larger accounts.", question:"I want to work with higher-net-worth clients. {context}. What does it take to attract and serve wealthier clients, and how do I position myself for that transition?" },
      { id:"f6", title:"How do I build my online presence professionally?", description:"Create a credible digital presence in a regulated field.", question:"I want a stronger online presence but I am in a regulated field. {context}. What can financial professionals do online to build credibility and attract clients within regulatory guidelines?" },
      { id:"f7", title:"How do I host an effective client event?", description:"Use events to deepen relationships and attract prospects.", question:"I want to use events to grow my practice. {context}. What makes a client event effective, and how do I plan and execute one that actually generates results?" },
      { id:"f8", title:"How do I handle a client who wants to leave?", description:"Navigate a client relationship that is at risk.", question:"I have a client who seems unhappy and may be considering leaving. {context}. How do I handle this situation professionally and what can I do to retain the relationship?" },
      { id:"f9", title:"How do I expand into a new niche?", description:"Develop expertise in a specific client segment.", question:"I want to specialize in a specific type of client or financial need. {context}. How do I build credibility and attract clients in a new niche?" },
      { id:"f10", title:"How do I balance compliance with marketing?", description:"Market effectively within regulatory requirements.", question:"I want to market my practice but compliance requirements make it complicated. {context}. How do financial professionals market themselves effectively while staying within compliance boundaries?" },
      { id:"f11", title:"How do I transition from a large firm to independence?", description:"Make the move from employee to independent advisor.", question:"I am considering going independent or moving to a different type of firm. {context}. What are the most important things to consider and prepare for before making that transition?" },
      { id:"f12", title:"How do I talk to clients about market volatility?", description:"Communicate with clients during uncertain market conditions.", question:"My clients are anxious about market conditions and I need to communicate effectively. {context}. What are the most effective ways to talk to clients during periods of market uncertainty?" },
      { id:"f13", title:"How do I build strategic referral partnerships?", description:"Develop relationships with professionals who can refer clients.", question:"I want to build relationships with CPAs, attorneys, and other professionals who could refer clients to me. {context}. How do I build these partnerships in a way that benefits everyone?" },
      { id:"f14", title:"How do I increase my revenue per client?", description:"Deepen relationships and serve existing clients more fully.", question:"I want to grow revenue without adding more clients. {context}. What are the most effective strategies for deepening relationships and increasing the value I provide to existing clients?" },
      { id:"f15", title:"How do I plan for succession?", description:"Build a practice that is sustainable and transferable.", question:"I need to start thinking about the long-term future of my practice. {context}. What are the most important steps in planning for succession or transitioning my practice?" },
    ]
  },
  {
    id: "education",
    label: "Education",
    description: "Growing your impact, income, and career as an educator.",
    icon: "◎",
    questions: [
      { id:"ed1", title:"How do I monetize my teaching expertise?", description:"Turn your classroom skills into additional income.", question:"I am an educator who wants to earn additional income from my expertise. {context}. What are the most realistic ways for someone with my background and skills to monetize my teaching expertise?" },
      { id:"ed2", title:"How do I create and sell an online course?", description:"Package your knowledge into a product people will pay for.", question:"I want to create an online course but I do not know where to start. {context}. What are the most important steps for creating a course that people will actually buy and complete?" },
      { id:"ed3", title:"How do I build my reputation as an education expert?", description:"Become recognized as a leader in your educational field.", question:"I want to be known as an expert in my area of education. {context}. What are the most effective ways to build a professional reputation outside of my current institution?" },
      { id:"ed4", title:"How do I get speaking opportunities at conferences?", description:"Land invitations to speak at education events.", question:"I want to speak at education conferences and events. {context}. How do I position myself to get speaking invitations and what does a strong conference proposal look like?" },
      { id:"ed5", title:"How do I publish in my field?", description:"Get your ideas and research into publications.", question:"I want to publish articles, research, or a book in my field. {context}. What are realistic pathways to publication for someone at my stage and with my expertise?" },
      { id:"ed6", title:"How do I transition from classroom teacher to administrator?", description:"Move into educational leadership and administration.", question:"I want to move into school administration or educational leadership. {context}. What are the most important steps for making that transition successfully?" },
      { id:"ed7", title:"How do I start a tutoring or coaching business?", description:"Build a private practice around your teaching skills.", question:"I want to start a tutoring or educational coaching business. {context}. What does it take to build a sustainable tutoring or coaching practice, and how do I get my first clients?" },
      { id:"ed8", title:"How do I get grant funding for my programs?", description:"Secure funding to expand educational initiatives.", question:"I want to get grant funding for an educational program or initiative. {context}. Where should I look for funding and what makes a grant application compelling?" },
      { id:"ed9", title:"How do I build better parent relationships?", description:"Create stronger communication with families.", question:"I struggle with certain parent relationships and want to improve how I communicate. {context}. What are the most effective strategies for building positive, productive relationships with parents?" },
      { id:"ed10", title:"How do I advocate for change in my school or district?", description:"Create meaningful change in your educational environment.", question:"I want to advocate for an important change in my school or district. {context}. What is the most effective approach for driving meaningful change in an educational institution?" },
      { id:"ed11", title:"How do I prevent burnout as an educator?", description:"Build sustainable habits to protect your energy.", question:"I am feeling burned out and it is affecting my teaching and personal life. {context}. What are practical strategies for recovering from burnout and building more sustainable habits as an educator?" },
      { id:"ed12", title:"How do I use social media as an educator?", description:"Build a professional presence online as a teacher.", question:"I want to build a professional presence on social media as an educator. {context}. What platforms make sense for educators, what kind of content works, and what should I be careful about?" },
      { id:"ed13", title:"How do I consult for schools or districts?", description:"Offer your expertise as an educational consultant.", question:"I want to offer consulting services to schools or districts. {context}. How do I position myself as a consultant and get my first consulting clients in education?" },
      { id:"ed14", title:"How do I negotiate a better contract or salary?", description:"Advocate for fair compensation in education.", question:"I want to negotiate a better salary or contract as an educator. {context}. How do I approach this conversation and what arguments are most effective?" },
      { id:"ed15", title:"How do I build community partnerships for my school?", description:"Connect your school with local organizations and businesses.", question:"I want to build meaningful partnerships between my school and the local community. {context}. What are the most effective strategies for creating mutually beneficial community partnerships?" },
    ]
  },
  {
    id: "nonprofit",
    label: "Nonprofit",
    description: "Growing your organization's impact, funding, and team.",
    icon: "◯",
    questions: [
      { id:"n1", title:"How do I diversify our funding sources?", description:"Reduce dependence on any single funder or revenue stream.", question:"Our organization relies too heavily on one or two funding sources. {context}. What are the most effective strategies for diversifying our revenue and reducing funding risk?" },
      { id:"n2", title:"How do I write a compelling grant proposal?", description:"Create grant applications that stand out and get funded.", question:"I need to improve our grant writing. {context}. What makes a grant proposal compelling, and what are the most common mistakes nonprofits make in their applications?" },
      { id:"n3", title:"How do I build major donor relationships?", description:"Cultivate relationships with significant individual donors.", question:"I want to build stronger relationships with major donors. {context}. What does effective major donor cultivation look like and how do I move someone from small donor to major donor?" },
      { id:"n4", title:"How do I recruit and retain volunteers?", description:"Build a reliable and engaged volunteer base.", question:"We struggle to recruit and retain quality volunteers. {context}. What are the most effective strategies for attracting committed volunteers and keeping them engaged?" },
      { id:"n5", title:"How do I measure and communicate our impact?", description:"Demonstrate your organization's effectiveness to funders and donors.", question:"We need to do a better job measuring and communicating our impact. {context}. What metrics matter most and how do we tell our impact story in a way that resonates with funders and donors?" },
      { id:"n6", title:"How do I build a high-performing board?", description:"Develop a board that actively supports the organization's mission.", question:"Our board is not as engaged or effective as it could be. {context}. What does a high-performing nonprofit board look like and how do we move in that direction?" },
      { id:"n7", title:"How do I handle a financial crisis?", description:"Navigate serious budget shortfalls or funding losses.", question:"Our organization is facing a financial crisis or significant funding loss. {context}. What are the most important steps we should take immediately and over the next few months?" },
      { id:"n8", title:"How do I grow our individual donor base?", description:"Build a sustainable community of individual supporters.", question:"We want to grow the number of individual donors giving to our organization. {context}. What are the most effective strategies for attracting new individual donors and increasing retention?" },
      { id:"n9", title:"How do I build organizational capacity?", description:"Strengthen the infrastructure that supports your mission.", question:"We need to build our organizational capacity but have limited resources. {context}. What are the most important investments we can make to strengthen our infrastructure and sustainability?" },
      { id:"n10", title:"How do I manage staff on a limited budget?", description:"Attract and retain quality staff without competitive salaries.", question:"We struggle to attract and retain good staff because we cannot compete on salary. {context}. What are the most effective strategies for building a committed team on a limited budget?" },
      { id:"n11", title:"How do I build community trust?", description:"Earn and maintain the confidence of the people you serve.", question:"We want to build stronger trust with the community we serve. {context}. What are the most effective ways to build genuine trust and credibility in our community?" },
      { id:"n12", title:"How do I create an effective annual fund campaign?", description:"Run a successful annual fundraising campaign.", question:"We want to improve our annual fund campaign. {context}. What are the key elements of an effective annual fund campaign and what mistakes should we avoid?" },
      { id:"n13", title:"How do I plan a successful fundraising event?", description:"Run events that raise money and build donor relationships.", question:"We are planning a fundraising event and want to make it successful. {context}. What makes fundraising events effective and what are the most important things to get right?" },
      { id:"n14", title:"How do I navigate a leadership transition?", description:"Handle changes in executive leadership smoothly.", question:"Our organization is going through or planning a leadership transition. {context}. What are the most important steps to ensure a smooth transition that protects the organization?" },
      { id:"n15", title:"How do I build corporate partnerships?", description:"Develop mutually beneficial relationships with businesses.", question:"We want to build stronger corporate partnerships. {context}. What do companies look for in nonprofit partnerships and how do we approach them effectively?" },
    ]
  },
  {
    id: "wellness",
    label: "Wellness",
    description: "Building a sustainable wellness practice and client base.",
    icon: "◌",
    questions: [
      { id:"w1", title:"How do I get my first coaching or wellness clients?", description:"Land your first paying clients in the wellness space.", question:"I am trying to get my first paying clients as a wellness professional. {context}. What are the most direct and effective ways to attract clients when I am just getting started?" },
      { id:"w2", title:"How do I package and price my services?", description:"Create clear offers at prices that reflect your value.", question:"I am struggling to package my services and figure out what to charge. {context}. How do I create clear, compelling packages and price them appropriately?" },
      { id:"w3", title:"How do I build credibility in a crowded market?", description:"Establish yourself as a trusted voice in the wellness space.", question:"The wellness space is very crowded and I struggle to stand out. {context}. What are the most effective ways to build credibility and differentiate myself?" },
      { id:"w4", title:"How do I transition from in-person to online clients?", description:"Build a virtual practice alongside or instead of in-person.", question:"I want to work with clients online but most of my experience has been in person. {context}. How do I make this transition effectively and attract virtual clients?" },
      { id:"w5", title:"How do I build recurring revenue?", description:"Create income that does not depend on constantly finding new clients.", question:"My income depends on constantly finding new clients. {context}. What are the most realistic ways to build recurring revenue in my wellness practice?" },
      { id:"w6", title:"How do I market myself without feeling salesy?", description:"Promote your services in a way that feels authentic.", question:"I feel uncomfortable marketing myself and my services. {context}. What are effective ways to attract clients that feel genuine and aligned with my values as a wellness professional?" },
      { id:"w7", title:"How do I get referrals from healthcare providers?", description:"Build relationships with doctors and other providers who can refer clients.", question:"I want to build referral relationships with healthcare providers. {context}. How do I approach healthcare professionals and build relationships that result in referrals?" },
      { id:"w8", title:"How do I create a group program?", description:"Serve multiple clients at once through group offerings.", question:"I want to create a group program instead of only working one-on-one. {context}. How do I design a group program that delivers real results and is easier to sell?" },
      { id:"w9", title:"How do I handle clients who are not making progress?", description:"Navigate coaching relationships where progress has stalled.", question:"I have clients who are not making progress and I am not sure how to handle it. {context}. What is the most effective approach when a client is stuck or not following through?" },
      { id:"w10", title:"How do I set appropriate boundaries with clients?", description:"Create professional boundaries that protect you and your clients.", question:"I struggle with setting appropriate boundaries with clients. {context}. What does healthy professional boundary-setting look like in a wellness practice and how do I implement it?" },
      { id:"w11", title:"How do I specialize without limiting myself?", description:"Find a niche while keeping your options open.", question:"I want to specialize in a specific area of wellness but I am afraid of being too narrow. {context}. How do I find the right niche and market it without cutting off other opportunities?" },
      { id:"w12", title:"How do I build my email list?", description:"Grow a list of interested people who might become clients.", question:"I want to build an email list but I am not sure how to start. {context}. What are effective strategies for building an email list as a wellness professional?" },
      { id:"w13", title:"How do I partner with gyms or studios?", description:"Create relationships with fitness facilities that lead to clients.", question:"I want to partner with gyms, yoga studios, or other wellness facilities. {context}. How do I approach these partnerships and structure them in a way that benefits both parties?" },
      { id:"w14", title:"How do I charge more without losing clients?", description:"Raise your rates while retaining your best clients.", question:"I know I need to raise my rates but I am afraid of losing clients. {context}. How do I raise my prices strategically without damaging my client relationships?" },
      { id:"w15", title:"How do I handle burnout in a helping profession?", description:"Protect your own wellbeing while supporting others.", question:"I am experiencing burnout despite loving what I do. {context}. What are practical strategies for recovering from burnout and building more sustainable practices as a wellness professional?" },
    ]
  },
  {
    id: "healthcare",
    label: "Healthcare",
    description: "Building your practice, career, and impact in healthcare.",
    icon: "◐",
    questions: [
      { id:"h1", title:"How do I build my patient or client base?", description:"Grow the number of people you serve in your practice.", question:"I want to build my patient or client base. {context}. What are the most effective strategies for attracting new patients or clients to my practice?" },
      { id:"h2", title:"How do I transition to private practice?", description:"Move from employed healthcare to running your own practice.", question:"I am considering starting or transitioning to private practice. {context}. What are the most important things I need to prepare for and what are the biggest risks to plan for?" },
      { id:"h3", title:"How do I market my practice within ethical guidelines?", description:"Promote your services professionally and appropriately.", question:"I want to market my practice but I want to do it ethically and professionally. {context}. What are effective and appropriate marketing strategies for healthcare professionals?" },
      { id:"h4", title:"How do I build a strong referral network?", description:"Create relationships with other providers who send you patients.", question:"I want to build a stronger referral network with other healthcare providers. {context}. How do I build professional relationships that result in consistent referrals?" },
      { id:"h5", title:"How do I add a cash-pay service to my practice?", description:"Offer services outside of insurance to increase revenue.", question:"I want to offer some cash-pay services outside of insurance. {context}. What are the most important considerations and how do I introduce this to my current and prospective patients?" },
      { id:"h6", title:"How do I become a thought leader in my specialty?", description:"Build a professional reputation beyond your current role.", question:"I want to become recognized as a thought leader in my specialty. {context}. What are the most effective ways to build a professional reputation and become known in my field?" },
      { id:"h7", title:"How do I advance into healthcare leadership?", description:"Move into administrative, leadership, or executive roles.", question:"I want to move into healthcare leadership or administration. {context}. What steps should I take to position myself for leadership roles in healthcare?" },
      { id:"h8", title:"How do I manage the business side of my practice?", description:"Improve the operational and financial health of your practice.", question:"I am strong clinically but the business side of my practice is a weakness. {context}. What are the most important business skills and systems I need to run a successful practice?" },
      { id:"h9", title:"How do I improve patient retention?", description:"Keep patients engaged and returning for continued care.", question:"I want to improve patient retention and reduce the number who do not follow through with care. {context}. What are effective strategies for keeping patients engaged and coming back?" },
      { id:"h10", title:"How do I deal with burnout in healthcare?", description:"Recover and protect yourself from professional exhaustion.", question:"I am experiencing burnout and it is affecting both my performance and my health. {context}. What are practical strategies for recovering from burnout while managing my professional responsibilities?" },
      { id:"h11", title:"How do I introduce telehealth into my practice?", description:"Add virtual care options for your patients.", question:"I want to integrate telehealth into my practice. {context}. What are the most important considerations and how do I implement telehealth effectively?" },
      { id:"h12", title:"How do I attract a specific type of patient?", description:"Focus your practice on a particular patient population.", question:"I want to specialize in serving a specific type of patient. {context}. How do I position my practice and attract more patients in my target population?" },
      { id:"h13", title:"How do I prepare for value-based care?", description:"Navigate the shift toward outcomes-based healthcare models.", question:"My practice is facing pressure to move toward value-based care models. {context}. What do I need to understand and prepare for to succeed in a value-based care environment?" },
      { id:"h14", title:"How do I negotiate a better employment contract?", description:"Advocate for fair terms in your healthcare employment.", question:"I am negotiating an employment contract as a healthcare professional. {context}. What are the most important terms to negotiate and how do I approach this conversation?" },
      { id:"h15", title:"How do I build a better work-life balance?", description:"Create boundaries that protect your personal life without harming your career.", question:"I struggle to maintain any real work-life balance in healthcare. {context}. What are realistic strategies for creating better boundaries while still meeting the demands of my role?" },
    ]
  },
];

// ─── QUESTIONS ────────────────────────────────────────────────────────────────

export function getQuestions(catId, industry, stage) {
  const ind = (industry || "").toLowerCase();
  const isEarly    = stage === "starting";
  const isScaling  = stage === "established" || stage === "optimizing";
  const isProduct  = /retail|restaurant|food|e-commerce/.test(ind);
  const isCorporate= /finance|tech|healthcare|education|nonprofit/.test(ind);
  const isCreative = /content|video|photo|media/.test(ind);

  const q = {
    business: [
      { q:`Tell us about your ${industry||"business"} right now.`,
        hint:"Include: what you do, how long you have been at it, current revenue or clients, what is working, and what feels stuck.",
        example:"e.g. 2 years as a real estate agent, 4 deals closed, mostly referrals, $40K total. I have no system for finding new clients.",
        type:"text" },
      { q:"What is your single biggest constraint to growth right now?",
        type:"pills", options: isProduct
          ? ["Not enough foot traffic","Low repeat customers","Pricing or margins","Too dependent on one channel","No team to delegate to","Unclear brand identity"]
          : isEarly
          ? ["No clients yet","Unclear on my offer","Charging too little","No one knows I exist","Doing too much myself","Not sure where to start"]
          : ["Revenue has plateaued","Finding consistent clients","Pricing below my value","No time to grow","Need to hire or delegate","Ready to move from service to scale"] },
      { q:"What does financial success look like in the next 6 months?",
        type:"pills", options:["Under $5K/mo","$5K–$10K/mo","$10K–$25K/mo","$25K–$50K/mo","$50K+/mo","Profitability over revenue"] },
      { q:isProduct
          ? "Describe your product or service, your current customer, and the gap between where you are and where you want to be."
          : "Describe your current offer — who you serve, what you deliver, and what makes you different.",
        hint:"The more specific you are here, the more specific your strategy will be.",
        example:isEarly?"e.g. I offer social media management for salons. $500/month. 2 clients. Not sure how to find more.":"e.g. Photography for female entrepreneurs. $1,500/session. 10 regulars. Cannot raise rates.",
        type:"text" },
      ...(isScaling?[{q:"What have you already tried that has not worked?",
        hint:"Be honest. This helps us avoid recommending the same thing.",
        example:"e.g. Tried Instagram for 3 months — no clients. Ran Facebook ads — no results.",
        type:"text"}]:[]),
    ],
    visibility: [
      { q:`Where does your audience in ${industry||"your field"} currently discover people like you?`,
        type:"pills-multi", options:["Instagram","LinkedIn","TikTok","Google Search","Referrals","Podcast appearances","In-person events","YouTube","Not sure"] },
      { q:"How would you honestly describe your current visibility?",
        type:"pills", options:["Essentially invisible","Some presence, inconsistent","Moderate but not growing","Strong locally, want broader reach","Known in my niche, want mainstream","Already visible, want to monetize"] },
      { q:"What is your biggest barrier to showing up consistently?",
        type:"pills", options:["No clear message or positioning","Do not know what content to create","Not enough time","Fear of being seen","Small or unengaged audience","No strategy — just posting randomly"] },
      { q:"Describe what full visibility looks like — what you would be known for, where you would appear, and what it would do for your business.",
        hint:"Think about: platforms, audience, and the business result.",
        example:"e.g. Known as the go-to branding photographer in Atlanta. 10K followers. Featured in 2 publications this year.",
        type:"text" },
    ],
    opportunities: [
      { q:`What type of opportunity would have the most direct impact on your ${industry||"work"} right now?`,
        type:"pills", options:["Speaking at events","Brand or corporate partnerships","Media features or press","Paid collaborations","Strategic referral relationships","Funding or investment","Landing a dream client","Licensing or white-label deals"] },
      { q:"How active are you right now in pursuing opportunities?",
        type:"pills", options:["Not pursuing anything","Occasionally when I think of it","Loose system but inconsistent","Actively pitching and following up","Very strategic — ongoing pipeline"] },
      { q:"What is the main thing holding you back?",
        type:"pills", options:["Do not know who to contact","No pitch materials or portfolio","Unclear on what value I bring","Getting rejected or no responses","Imposter syndrome","Too busy — need a system"] },
      { q:"Describe the most valuable opportunity you could land in the next 90 days.",
        hint:"Be as specific as possible — name the type of brand, client, or event.",
        example:"e.g. A speaking spot at a women's business conference. Visibility with female entrepreneurs.",
        type:"text" },
    ],
    career: [
      { q:"How would you describe where you are in your career right now?",
        type:"pills", options:["Early — building experience","Mid-level — ready for more","Senior or leadership level","Actively pivoting industries","Returning after a break","Independent professional"] },
      { q:"What is your most pressing career challenge?",
        type:"pills", options:isCorporate
          ? ["Stuck at same level too long","Underpaid relative to market","Want to move into leadership","Culture does not fit","Want to transition out","Need internal visibility"]
          : ["No clear direction","Underpaid or undervalued","Need to build my reputation","Want my own business","Missing strategic relationships","Imposter syndrome limiting growth"] },
      { q:"What does your ideal career look like 12 months from now?",
        type:"pills", options:["Promoted to new title","New company or organization","25–40% higher income","My own business or practice","Advisory or board roles","Published or recognized thought leader"] },
      { q:"Tell us about your professional background and what makes you different.",
        hint:"Include: field, years of experience, key accomplishments, skills, what you are known for.",
        example:"e.g. 12 years in healthcare administration. Led a team of 40 through a hospital merger. Known for getting departments to collaborate.",
        type:"text" },
    ],
    networking: [
      { q:`In ${industry||"your field"}, where do the most valuable relationships typically develop?`,
        type:"pills-multi", options:["Referral networks","Industry associations","LinkedIn","Conferences and events","Through clients","Social media","Community groups","Local business groups","Alumni networks"] },
      { q:"How would you honestly describe your current networking approach?",
        type:"pills", options:["Nonexistent — starting from zero","Reactive — only when I need something","Occasional but no real strategy","Moderate — some consistent activity","Intentional but results disappointing","Strategic — well connected but want more"] },
      { q:"What is the biggest obstacle?",
        type:"pills", options:["No system for staying in touch","Do not know who to target","Introversion or discomfort","Not enough time","Network feels outdated","Not sure what value I bring"] },
      { q:"Describe the network you want to build — who, why, and what you would bring.",
        hint:"Think about the types of people, why they matter to your goals, and what you offer.",
        example:"e.g. 10–15 consultants in adjacent fields for mutual referrals. I bring deep operations expertise and a strong track record.",
        type:"text" },
    ],
  };
  return q[catId] || q.business;
}
