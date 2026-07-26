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
    label: "Entrepreneurs & Small Business",
    description: "Launch, grow, and scale your business with focused strategic guidance.",
    icon: "01",
    questions: [
      { id:"e1", title:"Develop a business from concept to launch...", description:"Develop a business from concept to launch with minimal startup capital.", question:"Develop a business from concept to launch with minimal startup capital." },
      { id:"e2", title:"Create a comprehensive business plan for a...", description:"Create a comprehensive business plan for a new venture.", question:"Create a comprehensive business plan for a new venture." },
      { id:"e3", title:"Identify and define an ideal target market...", description:"Identify and define an ideal target market and customer profile.", question:"Identify and define an ideal target market and customer profile." },
      { id:"e4", title:"Design a cost-effective marketing strategy for a...", description:"Design a cost-effective marketing strategy for a startup business.", question:"Design a cost-effective marketing strategy for a startup business." },
      { id:"e5", title:"Establish a pricing strategy that balances competitiveness...", description:"Establish a pricing strategy that balances competitiveness and profitability.", question:"Establish a pricing strategy that balances competitiveness and profitability." },
      { id:"e6", title:"Build a 90-day business launch and growth roadmap", description:"Build a 90-day business launch and growth roadmap.", question:"Build a 90-day business launch and growth roadmap." },
      { id:"e7", title:"Determine the legal, licensing, and regulatory requirements...", description:"Determine the legal, licensing, and regulatory requirements for a new business.", question:"Determine the legal, licensing, and regulatory requirements for a new business." },
      { id:"e8", title:"Develop a brand identity, including positioning, messaging...", description:"Develop a brand identity, including positioning, messaging, and value propositio...", question:"Develop a brand identity, including positioning, messaging, and value proposition." },
      { id:"e9", title:"Create a customer acquisition strategy for generating...", description:"Create a customer acquisition strategy for generating initial sales and clients.", question:"Create a customer acquisition strategy for generating initial sales and clients." },
      { id:"e10", title:"Build a startup budget, financial forecast, and...", description:"Build a startup budget, financial forecast, and cash flow management plan.", question:"Build a startup budget, financial forecast, and cash flow management plan." },
      { id:"e11", title:"Develop a scalable growth strategy while maintaining...", description:"Develop a scalable growth strategy while maintaining operational efficiency.", question:"Develop a scalable growth strategy while maintaining operational efficiency." },
      { id:"e12", title:"Analyze a business model and identify opportunities...", description:"Analyze a business model and identify opportunities for expansion and optimizati...", question:"Analyze a business model and identify opportunities for expansion and optimization." },
      { id:"e13", title:"Create a 12-month strategic revenue growth plan", description:"Create a 12-month strategic revenue growth plan.", question:"Create a 12-month strategic revenue growth plan." },
      { id:"e14", title:"Identify business processes suitable for automation and...", description:"Identify business processes suitable for automation and operational improvement.", question:"Identify business processes suitable for automation and operational improvement." },
      { id:"e15", title:"Design an organizational structure that supports long-term...", description:"Design an organizational structure that supports long-term growth and leadership...", question:"Design an organizational structure that supports long-term growth and leadership development." },
      { id:"e16", title:"Evaluate new revenue streams, market opportunities, and...", description:"Evaluate new revenue streams, market opportunities, and business diversification...", question:"Evaluate new revenue streams, market opportunities, and business diversification strategies." },
      { id:"e17", title:"Develop a customer retention and loyalty strategy...", description:"Develop a customer retention and loyalty strategy to increase lifetime value.", question:"Develop a customer retention and loyalty strategy to increase lifetime value." },
      { id:"e18", title:"Improve profitability through operational efficiencies and cost...", description:"Improve profitability through operational efficiencies and cost management initi...", question:"Improve profitability through operational efficiencies and cost management initiatives." },
      { id:"e19", title:"Build a KPI framework and executive performance dashboard", description:"Build a KPI framework and executive performance dashboard.", question:"Build a KPI framework and executive performance dashboard." },
      { id:"e20", title:"Create an exit, succession, acquisition, or merger...", description:"Create an exit, succession, acquisition, or merger strategy for long-term busine...", question:"Create an exit, succession, acquisition, or merger strategy for long-term business value." },
    ]
  },
  {
    id: "corporate",
    label: "Corporate & Leadership",
    description: "Advance your career, strengthen your leadership, and build lasting influence.",
    icon: "02",
    questions: [
      { id:"c1", title:"Develop a strategic career advancement plan for...", description:"Develop a strategic career advancement plan for the next 12 months.", question:"Develop a strategic career advancement plan for the next 12 months." },
      { id:"c2", title:"Strengthen leadership skills and executive presence in...", description:"Strengthen leadership skills and executive presence in the workplace.", question:"Strengthen leadership skills and executive presence in the workplace." },
      { id:"c3", title:"Improve time management, productivity, and prioritization strategies", description:"Improve time management, productivity, and prioritization strategies.", question:"Improve time management, productivity, and prioritization strategies." },
      { id:"c4", title:"Build effective communication and stakeholder management skills", description:"Build effective communication and stakeholder management skills.", question:"Build effective communication and stakeholder management skills." },
      { id:"c5", title:"Create a professional development roadmap aligned with...", description:"Create a professional development roadmap aligned with career goals.", question:"Create a professional development roadmap aligned with career goals." },
      { id:"c6", title:"Develop strategies for managing workplace challenges and...", description:"Develop strategies for managing workplace challenges and difficult conversations...", question:"Develop strategies for managing workplace challenges and difficult conversations." },
      { id:"c7", title:"Enhance decision-making and problem-solving capabilities in a...", description:"Enhance decision-making and problem-solving capabilities in a corporate environm...", question:"Enhance decision-making and problem-solving capabilities in a corporate environment." },
      { id:"c8", title:"Build a high-impact personal brand within an organization", description:"Build a high-impact personal brand within an organization.", question:"Build a high-impact personal brand within an organization." },
      { id:"c9", title:"Create a plan for improving performance and...", description:"Create a plan for improving performance and achieving key objectives.", question:"Create a plan for improving performance and achieving key objectives." },
      { id:"c10", title:"Develop networking and relationship-building strategies for career growth", description:"Develop networking and relationship-building strategies for career growth.", question:"Develop networking and relationship-building strategies for career growth." },
      { id:"c11", title:"Develop a high-performing team culture that drives...", description:"Develop a high-performing team culture that drives engagement and results.", question:"Develop a high-performing team culture that drives engagement and results." },
      { id:"c12", title:"Create a leadership strategy for managing organizational...", description:"Create a leadership strategy for managing organizational growth and change.", question:"Create a leadership strategy for managing organizational growth and change." },
      { id:"c13", title:"Design an employee development and succession planning framework", description:"Design an employee development and succession planning framework.", question:"Design an employee development and succession planning framework." },
      { id:"c14", title:"Improve team performance through effective coaching and...", description:"Improve team performance through effective coaching and accountability systems.", question:"Improve team performance through effective coaching and accountability systems." },
      { id:"c15", title:"Build a strategic workforce planning and talent...", description:"Build a strategic workforce planning and talent retention strategy.", question:"Build a strategic workforce planning and talent retention strategy." },
      { id:"c16", title:"Develop a communication plan for leading through...", description:"Develop a communication plan for leading through organizational change.", question:"Develop a communication plan for leading through organizational change." },
      { id:"c17", title:"Create a performance management system aligned with...", description:"Create a performance management system aligned with business objectives.", question:"Create a performance management system aligned with business objectives." },
      { id:"c18", title:"Strengthen cross-functional collaboration and stakeholder alignment", description:"Strengthen cross-functional collaboration and stakeholder alignment.", question:"Strengthen cross-functional collaboration and stakeholder alignment." },
      { id:"c19", title:"Design a strategic planning framework for departmental...", description:"Design a strategic planning framework for departmental or organizational success...", question:"Design a strategic planning framework for departmental or organizational success." },
      { id:"c20", title:"Develop executive-level reporting, KPI tracking, and performance...", description:"Develop executive-level reporting, KPI tracking, and performance measurement sys...", question:"Develop executive-level reporting, KPI tracking, and performance measurement systems." },
      { id:"c21", title:"Assess current career trajectory and identify advancement opportunities", description:"Assess current career trajectory and identify advancement opportunities.", question:"Assess current career trajectory and identify advancement opportunities." },
      { id:"c22", title:"Create a strategy for securing a promotion...", description:"Create a strategy for securing a promotion within the next review cycle.", question:"Create a strategy for securing a promotion within the next review cycle." },
      { id:"c23", title:"Develop negotiation strategies for compensation, benefits, and...", description:"Develop negotiation strategies for compensation, benefits, and career advancemen...", question:"Develop negotiation strategies for compensation, benefits, and career advancement." },
      { id:"c24", title:"Improve influence and credibility with senior leadership", description:"Improve influence and credibility with senior leadership.", question:"Improve influence and credibility with senior leadership." },
      { id:"c25", title:"Identify skills gaps and create a professional...", description:"Identify skills gaps and create a professional growth plan.", question:"Identify skills gaps and create a professional growth plan." },
      { id:"c26", title:"Build a roadmap for transitioning into a...", description:"Build a roadmap for transitioning into a leadership role.", question:"Build a roadmap for transitioning into a leadership role." },
      { id:"c27", title:"Create a plan for increasing visibility and...", description:"Create a plan for increasing visibility and impact within an organization.", question:"Create a plan for increasing visibility and impact within an organization." },
      { id:"c28", title:"Evaluate career options and identify the most...", description:"Evaluate career options and identify the most strategic next move.", question:"Evaluate career options and identify the most strategic next move." },
      { id:"c29", title:"Develop a long-term wealth-building and career-growth strategy", description:"Develop a long-term wealth-building and career-growth strategy.", question:"Develop a long-term wealth-building and career-growth strategy." },
    ]
  },
  {
    id: "education",
    label: "Education",
    description: "Design learning experiences, master new subjects, and build teaching systems.",
    icon: "03",
    questions: [
      { id:"e1", title:"Create a personalized learning roadmap for a...", description:"Create a personalized learning roadmap for a subject from beginner to advanced l...", question:"Create a personalized learning roadmap for a subject from beginner to advanced level." },
      { id:"e2", title:"Explain a topic as if teaching a...", description:"Explain a topic as if teaching a 12-year-old, then as if teaching a college stud...", question:"Explain a topic as if teaching a 12-year-old, then as if teaching a college student." },
      { id:"e3", title:"Design a 30-day study plan for mastering...", description:"Design a 30-day study plan for mastering a subject.", question:"Design a 30-day study plan for mastering a subject." },
      { id:"e4", title:"Generate a complete lesson plan on a...", description:"Generate a complete lesson plan on a topic with objectives, activities, and asse...", question:"Generate a complete lesson plan on a topic with objectives, activities, and assessments." },
      { id:"e5", title:"Create a quiz with 20 questions and...", description:"Create a quiz with 20 questions and answer explanations on a topic.", question:"Create a quiz with 20 questions and answer explanations on a topic." },
      { id:"e6", title:"Identify the most important concepts someone should...", description:"Identify the most important concepts someone should learn first in a field.", question:"Identify the most important concepts someone should learn first in a field." },
      { id:"e7", title:"Turn a textbook chapter into concise study...", description:"Turn a textbook chapter into concise study notes and flashcards.", question:"Turn a textbook chapter into concise study notes and flashcards." },
      { id:"e8", title:"Recommend the best books, courses, videos, and...", description:"Recommend the best books, courses, videos, and resources for learning a subject.", question:"Recommend the best books, courses, videos, and resources for learning a subject." },
      { id:"e9", title:"Create practice exercises that gradually increase in...", description:"Create practice exercises that gradually increase in difficulty for a skill.", question:"Create practice exercises that gradually increase in difficulty for a skill." },
      { id:"e10", title:"Analyze my learning style and suggest the...", description:"Analyze my learning style and suggest the most effective study techniques.", question:"Analyze my learning style and suggest the most effective study techniques." },
      { id:"e11", title:"Generate a curriculum for a 12-week course...", description:"Generate a curriculum for a 12-week course on a topic.", question:"Generate a curriculum for a 12-week course on a topic." },
      { id:"e12", title:"Explain common mistakes students make when learning...", description:"Explain common mistakes students make when learning a subject and how to avoid t...", question:"Explain common mistakes students make when learning a subject and how to avoid them." },
      { id:"e13", title:"Create a Socratic tutoring session that teaches...", description:"Create a Socratic tutoring session that teaches a topic through questions.", question:"Create a Socratic tutoring session that teaches a topic through questions." },
      { id:"e14", title:"Build a complete exam preparation strategy for...", description:"Build a complete exam preparation strategy for a test or certification.", question:"Build a complete exam preparation strategy for a test or certification." },
      { id:"e15", title:"Compare different educational approaches to teaching a subject", description:"Compare different educational approaches to teaching a subject.", question:"Compare different educational approaches to teaching a subject." },
      { id:"e16", title:"Create real-world projects that help students apply...", description:"Create real-world projects that help students apply a topic practically.", question:"Create real-world projects that help students apply a topic practically." },
      { id:"e17", title:"Assess my current knowledge of a subject...", description:"Assess my current knowledge of a subject by asking diagnostic questions.", question:"Assess my current knowledge of a subject by asking diagnostic questions." },
      { id:"e18", title:"Generate memory aids, mnemonics, and retention techniques...", description:"Generate memory aids, mnemonics, and retention techniques for a topic.", question:"Generate memory aids, mnemonics, and retention techniques for a topic." },
      { id:"e19", title:"Design a self-paced learning program that fits...", description:"Design a self-paced learning program that fits into a set number of hours per we...", question:"Design a self-paced learning program that fits into a set number of hours per week." },
      { id:"e20", title:"Create a mastery checklist showing every skill...", description:"Create a mastery checklist showing every skill needed to become proficient in a...", question:"Create a mastery checklist showing every skill needed to become proficient in a field." },
    ]
  },
  {
    id: "realestate",
    label: "Real Estate",
    description: "Buy, invest, and build wealth through strategic real estate decisions.",
    icon: "04",
    questions: [
      { id:"r1", title:"Explain real estate investing from scratch and...", description:"Explain real estate investing from scratch and show me the fastest path to buyin...", question:"Explain real estate investing from scratch and show me the fastest path to buying my first property." },
      { id:"r2", title:"What type of real estate investment is...", description:"What type of real estate investment is best for a beginner with a set amount to...", question:"What type of real estate investment is best for a beginner with a set amount to invest?" },
      { id:"r3", title:"Create a beginner-friendly roadmap to become financially...", description:"Create a beginner-friendly roadmap to become financially independent through rea...", question:"Create a beginner-friendly roadmap to become financially independent through real estate." },
      { id:"r4", title:"Walk me through the entire home-buying process...", description:"Walk me through the entire home-buying process step by step and explain every te...", question:"Walk me through the entire home-buying process step by step and explain every term in plain English." },
      { id:"r5", title:"What are the biggest mistakes first-time homebuyers...", description:"What are the biggest mistakes first-time homebuyers and investors make, and how...", question:"What are the biggest mistakes first-time homebuyers and investors make, and how can I avoid them?" },
      { id:"r6", title:"Analyze my financial situation and tell me...", description:"Analyze my financial situation and tell me whether I am ready to buy a property.", question:"Analyze my financial situation and tell me whether I am ready to buy a property." },
      { id:"r7", title:"Create a checklist of everything I need...", description:"Create a checklist of everything I need before making an offer on a property.", question:"Create a checklist of everything I need before making an offer on a property." },
      { id:"r8", title:"Teach me how to evaluate a property...", description:"Teach me how to evaluate a property like a professional investor.", question:"Teach me how to evaluate a property like a professional investor." },
      { id:"r9", title:"Explain mortgages, interest rates, escrow, PMI, closing...", description:"Explain mortgages, interest rates, escrow, PMI, closing costs, and equity in sim...", question:"Explain mortgages, interest rates, escrow, PMI, closing costs, and equity in simple terms." },
      { id:"r10", title:"Build a 90-day action plan to help...", description:"Build a 90-day action plan to help me purchase my first investment property.", question:"Build a 90-day action plan to help me purchase my first investment property." },
      { id:"r11", title:"Analyze this property and provide cash flow...", description:"Analyze this property and provide cash flow, ROI, cap rate, and appreciation pot...", question:"Analyze this property and provide cash flow, ROI, cap rate, and appreciation potential." },
      { id:"r12", title:"Compare multiple properties and rank them from...", description:"Compare multiple properties and rank them from best to worst investment opportun...", question:"Compare multiple properties and rank them from best to worst investment opportunity." },
      { id:"r13", title:"Create a renovation strategy that maximizes property...", description:"Create a renovation strategy that maximizes property value while minimizing cost...", question:"Create a renovation strategy that maximizes property value while minimizing costs." },
      { id:"r14", title:"Evaluate whether this property is better suited...", description:"Evaluate whether this property is better suited for flipping, long-term rental,...", question:"Evaluate whether this property is better suited for flipping, long-term rental, or short-term rental." },
      { id:"r15", title:"Generate a negotiation strategy for buying this...", description:"Generate a negotiation strategy for buying this property below asking price.", question:"Generate a negotiation strategy for buying this property below asking price." },
      { id:"r16", title:"Review my real estate portfolio and identify...", description:"Review my real estate portfolio and identify opportunities to improve returns an...", question:"Review my real estate portfolio and identify opportunities to improve returns and reduce risk." },
      { id:"r17", title:"Design a strategy to scale from a...", description:"Design a strategy to scale from a current number of properties to a target numbe...", question:"Design a strategy to scale from a current number of properties to a target number within a timeframe." },
      { id:"r18", title:"Analyze market trends and identify emerging investment...", description:"Analyze market trends and identify emerging investment opportunities before they...", question:"Analyze market trends and identify emerging investment opportunities before they become mainstream." },
      { id:"r19", title:"Create a tax-efficient wealth-building strategy using real...", description:"Create a tax-efficient wealth-building strategy using real estate, depreciation,...", question:"Create a tax-efficient wealth-building strategy using real estate, depreciation, leverage, and entity structures." },
      { id:"r20", title:"Act as a real estate investment advisor...", description:"Act as a real estate investment advisor and challenge my assumptions before I ac...", question:"Act as a real estate investment advisor and challenge my assumptions before I acquire this property." },
    ]
  },
  {
    id: "finance",
    label: "Finance",
    description: "Build wealth, manage debt, and create long-term financial independence.",
    icon: "05",
    questions: [
      { id:"f1", title:"Act as my personal financial coach and...", description:"Act as my personal financial coach and create a step-by-step plan to improve my...", question:"Act as my personal financial coach and create a step-by-step plan to improve my finances based on my income, expenses, debt, and goals." },
      { id:"f2", title:"Explain personal finance fundamentals in simple terms...", description:"Explain personal finance fundamentals in simple terms and show me what I should...", question:"Explain personal finance fundamentals in simple terms and show me what I should focus on first." },
      { id:"f3", title:"Create a budget that helps me save...", description:"Create a budget that helps me save more money without sacrificing my lifestyle.", question:"Create a budget that helps me save more money without sacrificing my lifestyle." },
      { id:"f4", title:"Analyze my spending habits and identify opportunities...", description:"Analyze my spending habits and identify opportunities to reduce unnecessary expe...", question:"Analyze my spending habits and identify opportunities to reduce unnecessary expenses." },
      { id:"f5", title:"Build a debt payoff strategy using the...", description:"Build a debt payoff strategy using the fastest and most cost-effective method.", question:"Build a debt payoff strategy using the fastest and most cost-effective method." },
      { id:"f6", title:"Create a beginner-friendly investing roadmap for someone...", description:"Create a beginner-friendly investing roadmap for someone starting with a set amo...", question:"Create a beginner-friendly investing roadmap for someone starting with a set amount." },
      { id:"f7", title:"Explain stocks, bonds, ETFs, mutual funds, and...", description:"Explain stocks, bonds, ETFs, mutual funds, and index funds in plain English.", question:"Explain stocks, bonds, ETFs, mutual funds, and index funds in plain English." },
      { id:"f8", title:"Assess my emergency fund and determine how...", description:"Assess my emergency fund and determine how much I should save based on my situat...", question:"Assess my emergency fund and determine how much I should save based on my situation." },
      { id:"f9", title:"Create a 12-month financial improvement plan to...", description:"Create a 12-month financial improvement plan to increase my net worth.", question:"Create a 12-month financial improvement plan to increase my net worth." },
      { id:"f10", title:"Identify the biggest financial mistakes people make...", description:"Identify the biggest financial mistakes people make and how I can avoid them.", question:"Identify the biggest financial mistakes people make and how I can avoid them." },
      { id:"f11", title:"Analyze my financial situation and recommend the...", description:"Analyze my financial situation and recommend the optimal allocation between savi...", question:"Analyze my financial situation and recommend the optimal allocation between saving, investing, and debt reduction." },
      { id:"f12", title:"Create a diversified investment portfolio based on...", description:"Create a diversified investment portfolio based on my age, goals, and risk toler...", question:"Create a diversified investment portfolio based on my age, goals, and risk tolerance." },
      { id:"f13", title:"Evaluate multiple investment opportunities and rank them...", description:"Evaluate multiple investment opportunities and rank them by risk-adjusted return...", question:"Evaluate multiple investment opportunities and rank them by risk-adjusted return potential." },
      { id:"f14", title:"Build a financial independence plan showing how...", description:"Build a financial independence plan showing how long it will take me to reach my...", question:"Build a financial independence plan showing how long it will take me to reach my target net worth." },
      { id:"f15", title:"Review my portfolio and identify weaknesses, risks...", description:"Review my portfolio and identify weaknesses, risks, and opportunities for improv...", question:"Review my portfolio and identify weaknesses, risks, and opportunities for improvement." },
      { id:"f16", title:"Act as a wealth advisor and design...", description:"Act as a wealth advisor and design a strategy to maximize long-term wealth creat...", question:"Act as a wealth advisor and design a strategy to maximize long-term wealth creation while managing risk." },
      { id:"f17", title:"Analyze current economic conditions and explain how...", description:"Analyze current economic conditions and explain how they may affect my investmen...", question:"Analyze current economic conditions and explain how they may affect my investments and financial goals." },
      { id:"f18", title:"Create a tax-efficient investment and wealth preservation strategy", description:"Create a tax-efficient investment and wealth preservation strategy.", question:"Create a tax-efficient investment and wealth preservation strategy." },
      { id:"f19", title:"Build a comprehensive retirement plan that includes...", description:"Build a comprehensive retirement plan that includes investments, income projecti...", question:"Build a comprehensive retirement plan that includes investments, income projections, healthcare costs, and withdrawal strategies." },
      { id:"f20", title:"Review my entire financial life and identify...", description:"Review my entire financial life and identify the highest-impact actions that cou...", question:"Review my entire financial life and identify the highest-impact actions that could improve my net worth over the next 5 to 10 years." },
    ]
  },
  {
    id: "nonprofit",
    label: "Nonprofit",
    description: "Grow your organization, increase your impact, and secure sustainable funding.",
    icon: "06",
    questions: [
      { id:"n1", title:"Conduct a comprehensive assessment of our mission...", description:"Conduct a comprehensive assessment of our mission, vision, and organizational ob...", question:"Conduct a comprehensive assessment of our mission, vision, and organizational objectives, and recommend strategic improvements to maximize long-term impact." },
      { id:"n2", title:"Develop a multi-year strategic plan that aligns...", description:"Develop a multi-year strategic plan that aligns organizational goals, community...", question:"Develop a multi-year strategic plan that aligns organizational goals, community needs, funding priorities, and measurable outcomes." },
      { id:"n3", title:"Evaluate whether our initiative is best structured...", description:"Evaluate whether our initiative is best structured as a nonprofit organization,...", question:"Evaluate whether our initiative is best structured as a nonprofit organization, charitable foundation, social enterprise, or public-private partnership." },
      { id:"n4", title:"Create a detailed organizational development roadmap outlining...", description:"Create a detailed organizational development roadmap outlining key milestones, o...", question:"Create a detailed organizational development roadmap outlining key milestones, operational requirements, and growth opportunities." },
      { id:"n5", title:"Perform a SWOT analysis and provide actionable...", description:"Perform a SWOT analysis and provide actionable recommendations to strengthen org...", question:"Perform a SWOT analysis and provide actionable recommendations to strengthen organizational effectiveness and sustainability." },
      { id:"n6", title:"Design a diversified fundraising strategy incorporating grants...", description:"Design a diversified fundraising strategy incorporating grants, major gifts, rec...", question:"Design a diversified fundraising strategy incorporating grants, major gifts, recurring donations, corporate sponsorships, and fundraising events." },
      { id:"n7", title:"Develop a donor engagement and stewardship framework...", description:"Develop a donor engagement and stewardship framework that strengthens long-term...", question:"Develop a donor engagement and stewardship framework that strengthens long-term supporter relationships and retention." },
      { id:"n8", title:"Identify potential funding opportunities and create a...", description:"Identify potential funding opportunities and create a targeted funding acquisiti...", question:"Identify potential funding opportunities and create a targeted funding acquisition strategy aligned with our mission." },
      { id:"n9", title:"Create a comprehensive annual fundraising plan with...", description:"Create a comprehensive annual fundraising plan with projected goals, timelines,...", question:"Create a comprehensive annual fundraising plan with projected goals, timelines, and performance metrics." },
      { id:"n10", title:"Analyze our current revenue model and recommend...", description:"Analyze our current revenue model and recommend strategies to improve financial...", question:"Analyze our current revenue model and recommend strategies to improve financial sustainability and reduce funding risk." },
      { id:"n11", title:"Assess community needs and develop evidence-based programs...", description:"Assess community needs and develop evidence-based programs that address the high...", question:"Assess community needs and develop evidence-based programs that address the highest-priority challenges." },
      { id:"n12", title:"Design a community engagement strategy that fosters...", description:"Design a community engagement strategy that fosters trust, participation, and me...", question:"Design a community engagement strategy that fosters trust, participation, and meaningful stakeholder collaboration." },
      { id:"n13", title:"Create a volunteer management framework covering recruitment...", description:"Create a volunteer management framework covering recruitment, onboarding, traini...", question:"Create a volunteer management framework covering recruitment, onboarding, training, retention, and recognition." },
      { id:"n14", title:"Develop a partnership strategy for collaboration with...", description:"Develop a partnership strategy for collaboration with government agencies, educa...", question:"Develop a partnership strategy for collaboration with government agencies, educational institutions, businesses, and community organizations." },
      { id:"n15", title:"Design a scalable program model that maximizes...", description:"Design a scalable program model that maximizes community impact while maintainin...", question:"Design a scalable program model that maximizes community impact while maintaining operational efficiency." },
      { id:"n16", title:"Develop a performance measurement framework with key...", description:"Develop a performance measurement framework with key performance indicators, out...", question:"Develop a performance measurement framework with key performance indicators, outcome metrics, and reporting standards." },
      { id:"n17", title:"Create an impact assessment methodology to evaluate...", description:"Create an impact assessment methodology to evaluate program effectiveness and de...", question:"Create an impact assessment methodology to evaluate program effectiveness and demonstrate value to stakeholders." },
      { id:"n18", title:"Design a data collection and reporting system...", description:"Design a data collection and reporting system that supports transparency, accoun...", question:"Design a data collection and reporting system that supports transparency, accountability, and continuous improvement." },
      { id:"n19", title:"Prepare a professional impact report framework suitable...", description:"Prepare a professional impact report framework suitable for donors, grantmakers,...", question:"Prepare a professional impact report framework suitable for donors, grantmakers, board members, and community partners." },
      { id:"n20", title:"Evaluate organizational performance and provide recommendations to...", description:"Evaluate organizational performance and provide recommendations to improve outco...", question:"Evaluate organizational performance and provide recommendations to improve outcomes, efficiency, and long-term sustainability." },
    ]
  },
  {
    id: "wellness",
    label: "Wellness",
    description: "Build sustainable habits, improve your health, and optimize your well-being.",
    icon: "07",
    questions: [
      { id:"w1", title:"Act as a wellness consultant and develop...", description:"Act as a wellness consultant and develop a personalized health improvement plan...", question:"Act as a wellness consultant and develop a personalized health improvement plan based on my goals, lifestyle, habits, and challenges." },
      { id:"w2", title:"Conduct a comprehensive wellness assessment and identify...", description:"Conduct a comprehensive wellness assessment and identify opportunities to improv...", question:"Conduct a comprehensive wellness assessment and identify opportunities to improve my physical, mental, and emotional well-being." },
      { id:"w3", title:"Create a sustainable daily wellness routine that...", description:"Create a sustainable daily wellness routine that optimizes energy, productivity,...", question:"Create a sustainable daily wellness routine that optimizes energy, productivity, recovery, and overall health." },
      { id:"w4", title:"Analyze my current lifestyle and recommend evidence-based...", description:"Analyze my current lifestyle and recommend evidence-based strategies to improve...", question:"Analyze my current lifestyle and recommend evidence-based strategies to improve long-term health outcomes." },
      { id:"w5", title:"Develop a holistic wellness roadmap that integrates...", description:"Develop a holistic wellness roadmap that integrates nutrition, exercise, sleep,...", question:"Develop a holistic wellness roadmap that integrates nutrition, exercise, sleep, stress management, and self-care practices." },
      { id:"w6", title:"Create a personalized nutrition plan aligned with...", description:"Create a personalized nutrition plan aligned with my health goals, dietary prefe...", question:"Create a personalized nutrition plan aligned with my health goals, dietary preferences, and activity level." },
      { id:"w7", title:"Evaluate my eating habits and provide recommendations...", description:"Evaluate my eating habits and provide recommendations to improve nutritional qua...", question:"Evaluate my eating habits and provide recommendations to improve nutritional quality and consistency." },
      { id:"w8", title:"Develop a meal-planning strategy that supports weight...", description:"Develop a meal-planning strategy that supports weight management, energy optimiz...", question:"Develop a meal-planning strategy that supports weight management, energy optimization, and overall wellness." },
      { id:"w9", title:"Analyze current nutrition trends and identify which...", description:"Analyze current nutrition trends and identify which approaches are most appropri...", question:"Analyze current nutrition trends and identify which approaches are most appropriate for my specific goals." },
      { id:"w10", title:"Create a practical framework for maintaining healthy...", description:"Create a practical framework for maintaining healthy habits while balancing work...", question:"Create a practical framework for maintaining healthy habits while balancing work, family, and personal responsibilities." },
      { id:"w11", title:"Design a customized fitness plan based on...", description:"Design a customized fitness plan based on my current fitness level, goals, and a...", question:"Design a customized fitness plan based on my current fitness level, goals, and available time." },
      { id:"w12", title:"Evaluate my sleep habits and provide a...", description:"Evaluate my sleep habits and provide a science-backed plan to improve sleep qual...", question:"Evaluate my sleep habits and provide a science-backed plan to improve sleep quality and recovery." },
      { id:"w13", title:"Create a stress management strategy using evidence-based...", description:"Create a stress management strategy using evidence-based techniques tailored to...", question:"Create a stress management strategy using evidence-based techniques tailored to my lifestyle." },
      { id:"w14", title:"Develop a mental wellness plan that addresses...", description:"Develop a mental wellness plan that addresses anxiety, focus, and emotional resi...", question:"Develop a mental wellness plan that addresses anxiety, focus, and emotional resilience." },
      { id:"w15", title:"Build a 90-day wellness transformation plan with...", description:"Build a 90-day wellness transformation plan with measurable milestones and accou...", question:"Build a 90-day wellness transformation plan with measurable milestones and accountability checkpoints." },
    ]
  },
  {
    id: "creative",
    label: "Creative & Media",
    description: "Grow your brand, create compelling content, and build a loyal audience.",
    icon: "08",
    questions: [
      { id:"c1", title:"Develop a comprehensive creative strategy for a...", description:"Develop a comprehensive creative strategy for a brand or creator that aligns mes...", question:"Develop a comprehensive creative strategy for a brand or creator that aligns messaging, audience positioning, and content direction." },
      { id:"c2", title:"Generate high-impact content concepts tailored to my...", description:"Generate high-impact content concepts tailored to my target audience, platform,...", question:"Generate high-impact content concepts tailored to my target audience, platform, and brand identity." },
      { id:"c3", title:"Create a structured content roadmap that balances...", description:"Create a structured content roadmap that balances evergreen content, trending to...", question:"Create a structured content roadmap that balances evergreen content, trending topics, and brand storytelling." },
      { id:"c4", title:"Define a unique creative direction and visual...", description:"Define a unique creative direction and visual identity for my brand across digit...", question:"Define a unique creative direction and visual identity for my brand across digital platforms." },
      { id:"c5", title:"Identify content gaps in my niche and...", description:"Identify content gaps in my niche and propose innovative formats to increase eng...", question:"Identify content gaps in my niche and propose innovative formats to increase engagement and differentiation." },
      { id:"c6", title:"Create high-performing scripts for short-form videos optimized...", description:"Create high-performing scripts for short-form videos optimized for TikTok, Insta...", question:"Create high-performing scripts for short-form videos optimized for TikTok, Instagram Reels, and YouTube Shorts." },
      { id:"c7", title:"Develop long-form content outlines for YouTube videos...", description:"Develop long-form content outlines for YouTube videos, podcasts, or documentarie...", question:"Develop long-form content outlines for YouTube videos, podcasts, or documentaries with strong narrative structure." },
      { id:"c8", title:"Transform a basic idea into a fully...", description:"Transform a basic idea into a fully developed piece of content including hook, s...", question:"Transform a basic idea into a fully developed piece of content including hook, structure, and call-to-action." },
      { id:"c9", title:"Rewrite and enhance existing content to improve...", description:"Rewrite and enhance existing content to improve clarity, engagement, and storyte...", question:"Rewrite and enhance existing content to improve clarity, engagement, and storytelling impact." },
      { id:"c10", title:"Generate multiple creative variations of a single...", description:"Generate multiple creative variations of a single concept for A/B testing across...", question:"Generate multiple creative variations of a single concept for A/B testing across platforms." },
      { id:"c11", title:"Develop a cohesive brand voice and tone...", description:"Develop a cohesive brand voice and tone guide tailored to my audience and indust...", question:"Develop a cohesive brand voice and tone guide tailored to my audience and industry." },
      { id:"c12", title:"Create compelling brand storytelling frameworks that communicate...", description:"Create compelling brand storytelling frameworks that communicate purpose, value,...", question:"Create compelling brand storytelling frameworks that communicate purpose, value, and differentiation." },
      { id:"c13", title:"Craft high-conversion messaging for marketing campaigns, landing...", description:"Craft high-conversion messaging for marketing campaigns, landing pages, and soci...", question:"Craft high-conversion messaging for marketing campaigns, landing pages, and social content." },
      { id:"c14", title:"Refine my personal or business brand positioning...", description:"Refine my personal or business brand positioning to stand out in a competitive m...", question:"Refine my personal or business brand positioning to stand out in a competitive market." },
      { id:"c15", title:"Generate tagline, slogan, and brand narrative options...", description:"Generate tagline, slogan, and brand narrative options aligned with my identity a...", question:"Generate tagline, slogan, and brand narrative options aligned with my identity and goals." },
      { id:"c16", title:"Design a content growth strategy to increase...", description:"Design a content growth strategy to increase followers, engagement, and retentio...", question:"Design a content growth strategy to increase followers, engagement, and retention across platforms." },
      { id:"c17", title:"Analyze my target audience and identify their...", description:"Analyze my target audience and identify their motivations, pain points, and cont...", question:"Analyze my target audience and identify their motivations, pain points, and content preferences." },
      { id:"c18", title:"Develop an engagement strategy that increases comments...", description:"Develop an engagement strategy that increases comments, shares, and community in...", question:"Develop an engagement strategy that increases comments, shares, and community interaction." },
      { id:"c19", title:"Create a content calendar optimized for consistency...", description:"Create a content calendar optimized for consistency, virality potential, and aud...", question:"Create a content calendar optimized for consistency, virality potential, and audience growth." },
      { id:"c20", title:"Evaluate performance metrics and recommend improvements to...", description:"Evaluate performance metrics and recommend improvements to maximize reach and en...", question:"Evaluate performance metrics and recommend improvements to maximize reach and engagement." },
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
