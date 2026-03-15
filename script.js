/**
 * Pinnacle Dental Centre - Global JavaScript
 */

// ===== HERO CAROUSEL =====
(function () {
    const INTERVAL = 5000; // 5 seconds per slide

    function initCarousel() {
        const slides = document.querySelectorAll('.hero-slide');
        const dots = document.querySelectorAll('.carousel-dot');
        if (!slides.length) return;

        let current = 0;
        let timer;

        function goTo(index) {
            slides[current].classList.remove('active');
            dots[current].classList.remove('w-8', 'bg-white');
            dots[current].classList.add('w-2', 'bg-white/40');

            current = (index + slides.length) % slides.length;

            slides[current].classList.add('active');
            dots[current].classList.add('w-8', 'bg-white');
            dots[current].classList.remove('w-2', 'bg-white/40');
        }

        function next() { goTo(current + 1); }

        function startTimer() {
            clearInterval(timer);
            timer = setInterval(next, INTERVAL);
        }

        // Dot click — jump to slide & restart timer
        dots.forEach(dot => {
            dot.addEventListener('click', () => {
                goTo(parseInt(dot.dataset.index));
                startTimer();
            });
        });

        startTimer();
    }

    document.addEventListener('DOMContentLoaded', initCarousel);
})();


// ===== SCROLL-TRIGGERED COUNTER ANIMATION =====
(function () {
    function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

    function animateCounter(el) {
        const target = parseInt(el.dataset.target, 10);
        const duration = 2000; // ms
        const start = performance.now();

        function tick(now) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const value = Math.round(easeOutCubic(progress) * target);

            // Add comma separators for thousands
            el.textContent = value.toLocaleString();

            if (progress < 1) requestAnimationFrame(tick);
        }

        requestAnimationFrame(tick);
    }

    function initCounters() {
        const counters = document.querySelectorAll('.counter');
        if (!counters.length) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    animateCounter(entry.target);
                    // no unobserve — replays each time section re-enters view
                }
            });
        }, { threshold: 0.5 });

        counters.forEach(counter => observer.observe(counter));
    }

    document.addEventListener('DOMContentLoaded', initCounters);
})();

// ===== ACTIVE NAV HIGHLIGHTING =====
(function () {
    const ACTIVE_CLASSES = ['bg-[#20C997]', 'text-white', '!text-white'];
    const INACTIVE_CLASSES = ['text-dark'];

    const navLinks = document.querySelectorAll('[data-nav]');
    const mobileLinks = document.querySelectorAll('[data-nav-mobile]');
    const isShopPage = window.location.pathname.includes('shop.html');

    function setActive(key) {
        navLinks.forEach(link => {
            const isActive = link.dataset.nav === key;
            link.classList.toggle('bg-[#20C997]', isActive);
            link.classList.toggle('text-white', isActive);
            link.classList.toggle('text-dark', !isActive);
        });
        mobileLinks.forEach(link => {
            const isActive = link.dataset.navMobile === key;
            link.classList.toggle('bg-[#20C997]', isActive);
            link.classList.toggle('text-white', isActive);
        });
    }

    // On shop.html, always highlight 'shop'
    if (isShopPage) { setActive('shop'); return; }

    // Map section IDs to nav keys
    const sectionMap = {
        'about': 'about',
        'services': 'services',
        'gallery': 'gallery',
        'blog': 'blog',
        'achievements': 'home',
        'contact': 'home',
    };

    // Default: highlight 'home'
    setActive('home');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const key = sectionMap[entry.target.id] || 'home';
                setActive(key);
            }
        });
    }, { threshold: 0.35, rootMargin: '-80px 0px 0px 0px' });

    // Watch all named sections
    ['about', 'services', 'gallery', 'blog', 'achievements', 'contact'].forEach(id => {
        const el = document.getElementById(id);
        if (el) observer.observe(el);
    });

    // When scrolled back near top → re-activate Home
    window.addEventListener('scroll', () => {
        if (window.scrollY < 200) setActive('home');
    }, { passive: true });
})();

// ===== SERVICES DATA & RENDERING =====
const SERVICES = [
    {
        id: 'invisalign',
        name: 'Invisalign',
        category: 'Orthodontics',
        icon: '🦷',
        accent: '#3198D8',
        img: 'invisalign.jpg',
        desc1: 'Discover the modern way to straighten your teeth with Invisalign aligners. Designed for comfort, convenience, and confidence.',
        desc2: '<h4 class="text-xl font-bold text-dark mb-4">Transform Your Smile Journey</h4><p class="text-gray-600 mb-6">Invisalign offers a modern, nearly invisible way to correct misaligned teeth without the hassle of traditional metal braces. The custom-made, removable aligners make it easier to maintain your oral hygiene while undergoing treatment.</p><div class="flex flex-col items-center p-6 bg-blue-50 rounded-3xl border border-blue-100 text-center"><img src="QR Code.png" alt="Invisalign QR Code" class="w-32 h-32 rounded-xl shadow-lg mb-4"><p class="text-sm font-semibold text-gray-700">Scan the QR code to see your before and after invisalign results.</p></div>',
        isNew: true,
        features: [
            { title: "Virtually Invisible", desc: "Clear aligners that people won't notice" },
            { title: "Comfortable Fit", desc: "Smooth, BPA-free plastic with no irritation" },
            { title: "Fast Results", desc: "See changes in as little as 18 months" }
        ]
    },
    {
        id: 'root-canal',
        name: 'Root Canal Treatment',
        category: 'Restorative',
        icon: '🔬',
        accent: '#17A2B8',
        img: 'root canal.webp',
        desc1: 'Root canal therapy removes infected or damaged pulp inside a tooth to relieve pain and save the tooth from extraction. Our advanced techniques ensure a comfortable and efficient procedure.',
        desc2: 'After treatment, the tooth is typically restored with a crown for strength and protection, allowing you to maintain normal function without discomfort.'
    },
    {
        id: 'dentures',
        name: 'Dentures & Implants',
        category: 'Restorative',
        icon: '😁',
        accent: '#20C997',
        img: 'Dentures & Implants.jpg',
        desc1: 'Dentures and dental implants offer reliable solutions for replacing missing teeth. Implants provide a permanent, natural-feeling option, while modern dentures are more comfortable and lifelike than ever before.',
        desc2: 'Our team will work with you to determine the best solution for your needs, restoring not just your smile but your quality of life.'
    },
    {
        id: 'crowns',
        name: 'Crowns & Bridges',
        category: 'Restorative',
        icon: '👑',
        accent: '#3198D8',
        img: 'Crowns and Bridges.jpg',
        desc1: 'Crowns and bridges are durable restorations that can replace missing teeth or protect damaged ones. Crafted to match your natural teeth, they restore your smile\'s appearance and functionality.',
        desc2: 'With proper care, crowns and bridges can last many years, helping you chew, speak, and smile confidently again.'
    },
    {
        id: 'veneers',
        name: 'Veneers',
        category: 'Cosmetic',
        icon: '✨',
        accent: '#20C997',
        img: 'Veneers.jpg',
        desc1: 'Veneers are ultra-thin shells placed over the front of teeth to correct chips, stains, or misalignment. They provide an instant transformation with a natural, luminous look.',
        desc2: 'Durable and stain-resistant, veneers offer a long-lasting solution for enhancing your smile with minimal tooth alteration.'
    },
    {
        id: 'cosmetic',
        name: 'Cosmetic Dentistry',
        category: 'Cosmetic',
        icon: '💎',
        accent: '#17A2B8',
        img: 'Cosmetic Dentistry.jpg',
        desc1: 'Cosmetic dentistry includes a wide range of treatments designed to improve the appearance of your teeth, gums, and overall smile. Options include veneers, bonding, reshaping, and whitening.',
        desc2: 'Whether you seek a subtle change or a full smile makeover, our experts will craft a customized plan to give you the confident, beautiful smile you deserve.'
    },
    {
        id: 'checkups',
        name: 'Dental Check-ups',
        category: 'Preventive',
        icon: '🏥',
        accent: '#3198D8',
        img: 'Dental Check-ups.jpg',
        desc1: 'Regular dental check-ups help catch potential issues before they become major problems. During these visits, we perform thorough cleanings, examinations, and necessary X-rays to maintain optimal oral health.',
        desc2: 'Prevention is the key to a healthy smile. Our friendly dental team ensures a comfortable experience while providing personalised advice on maintaining strong teeth and gums.'
    },
    {
        id: 'whitening',
        name: 'Teeth Whitening',
        category: 'Cosmetic',
        icon: '⭐',
        accent: '#20C997',
        img: 'Teeth Whitening.jpg',
        desc1: 'Our professional teeth whitening services can help lift years of staining and discoloration, giving you a noticeably whiter and more radiant smile. We offer in-office and at-home options to suit your lifestyle.',
        desc2: 'A brighter smile can boost your confidence and enhance your overall appearance. Let us help you achieve dazzling results safely and effectively.'
    },
    {
        id: 'braces',
        name: 'Braces',
        category: 'Orthodontics',
        icon: '🔧',
        accent: '#17A2B8',
        img: 'Braces.jpg',
        desc1: 'Braces have come a long way and now offer a variety of options, from metal to clear ceramic brackets. They are highly effective for correcting complex orthodontic issues and achieving a perfect bite.',
        desc2: 'Our orthodontic team will guide you through the process, ensuring the most comfortable and efficient treatment possible.'
    },
    {
        id: 'extraction',
        name: 'Tooth Extraction',
        category: 'Surgical',
        icon: '🦷',
        accent: '#3198D8',
        img: 'Tooth extraction.jpg',
        desc1: 'Sometimes, tooth extraction is necessary to protect your overall oral health. Whether due to severe decay, infection, or crowding, we ensure a gentle and comfortable procedure.',
        desc2: 'We also offer sedation options and detailed aftercare instructions to promote a smooth and speedy recovery.'
    },
    {
        id: 'paediatric',
        name: 'Paediatric Dentistry',
        category: 'Preventive',
        icon: '🧒',
        accent: '#20C997',
        img: 'Paediatric Dentistry.jpg',
        desc1: 'Our paediatric dental services focus on creating positive experiences for young patients while promoting lifelong healthy habits. We offer gentle cleanings, sealants, and early orthodontic evaluations.',
        desc2: 'Building a strong foundation of trust helps children develop confidence in dental care, ensuring healthier smiles as they grow.'
    },
    {
        id: 'fillings',
        name: 'Dental Fillings',
        category: 'Restorative',
        icon: '💊',
        accent: '#17A2B8',
        img: 'Dental Fillings and  Sealants.jpg',
        desc1: 'Dental fillings restore teeth affected by cavities, while sealants protect vulnerable areas from decay. Our team uses high-quality materials that blend naturally with your teeth.',
        desc2: 'Quick, painless treatments can make a huge difference in preventing more serious dental issues down the road.'
    },
    {
        id: 'xrays',
        name: 'Dental X-rays',
        category: 'Diagnostic',
        icon: '📡',
        accent: '#3198D8',
        img: 'Dental Exrays.jpg',
        desc1: 'Dental X-rays allow us to see beyond the surface and diagnose hidden issues such as cavities, infections, and bone loss. Our digital X-rays are quick, safe, and use minimal radiation.',
        desc2: 'Early detection through X-rays enables proactive treatment, helping to maintain a healthy, long-lasting smile.'
    }
];

// Accent colours mapped to Tailwind-safe inline styles (since dynamic classes won't purge)
function renderServices() {
    const grid = document.getElementById('services-grid');
    if (!grid) return;

    grid.innerHTML = SERVICES.map((svc, i) => `
        <button
            onclick="openServiceModal(${i})"
            class="service-card group text-left bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500 border border-gray-100 hover:border-transparent hover:-translate-y-1 focus:outline-none w-full"
            aria-label="Learn more about ${svc.name}">

            <!-- Card Image -->
            <div class="h-48 overflow-hidden relative">
                <img src="${svc.img}" alt="${svc.name}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700">
                <div class="absolute inset-0 bg-gradient-to-t from-dark/20 to-transparent"></div>
                ${svc.isNew ? '<div class="absolute top-4 right-4 z-10"><span class="absolute -inset-1 rounded-lg bg-red-500 opacity-40 animate-ping"></span><span class="relative inline-flex items-center text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg text-white bg-red-600 shadow-lg"><i data-lucide="zap" class="w-3 h-3 mr-1"></i>NEW</span></div>' : ''}
                <div class="absolute top-4 left-4">
                    <span class="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-lg text-white backdrop-blur-md bg-white/20 border border-white/30">
                        ${svc.category}
                    </span>
                </div>
            </div>

            <div class="p-6 flex flex-col gap-3">
                <!-- Icon + Title row -->
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                         style="background:${svc.accent}18">
                        ${svc.icon}
                    </div>
                    <h3 class="text-lg font-premium font-bold group-hover:text-pinnacle transition-colors leading-tight">${svc.name}</h3>
                </div>

                <p class="text-gray-500 text-xs leading-relaxed line-clamp-2">${svc.desc1}</p>

                <!-- Learn more -->
                <div class="flex items-center gap-2 font-bold text-[10px] uppercase tracking-wider mt-2 pt-3 border-t border-gray-50"
                     style="color:${svc.accent}">
                    Discovery Service
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
                    </svg>
                </div>
            </div>
        </button>
    `).join('');
}

function openServiceModal(index) {
    const svc = SERVICES[index];
    const modal = document.getElementById('service-modal');

    document.getElementById('modal-img').src = svc.img;
    document.getElementById('modal-img').alt = svc.name;
    document.getElementById('modal-title').textContent = svc.name;
    document.getElementById('modal-badge').textContent = svc.category;
    document.getElementById('modal-desc1').textContent = svc.desc1;

    let desc2Html = svc.desc2;
    if (svc.features) {
        desc2Html += '<div class="mt-6 bg-gray-50 p-5 rounded-2xl border border-gray-100"><h5 class="font-bold text-dark text-sm uppercase tracking-wider mb-4 flex items-center gap-2"><i data-lucide="info" class="w-4 h-4 text-pinnacle"></i> More Information</h5><ul class="space-y-3">';
        svc.features.forEach(f => {
            desc2Html += '<li class="flex items-start gap-3"><i data-lucide="check-circle-2" class="w-5 h-5 text-seafoam shrink-0 mt-0.5"></i><div><span class="font-bold text-dark text-sm">' + f.title + '</span><p class="text-sm text-gray-500 mt-0.5">' + f.desc + '</p></div></li>';
        });
        desc2Html += '</ul></div>';
    }
    document.getElementById('modal-desc2').innerHTML = desc2Html;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';
    lucide.createIcons();
}

function closeServiceModal() {
    const modal = document.getElementById('service-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.style.overflow = '';
}

// ===== BLOG DATA & RENDERING =====
const BLOG_POSTS = [
    {
        id: 'invisalign-future',
        title: 'Why Invisalign is the Future of Straighter Smiles.',
        tag: 'Aesthetics',
        readTime: '5 Min Read',
        date: 'March 7, 2026',
        img: 'invisalign.jpg',
        excerpt: 'Let’s be honest: when most of us think about straightening our teeth, we immediately picture the "metal-mouth" look from our high school days...',
        content: `
            <p>Let’s be honest: when most of us think about straightening our teeth, we immediately picture the "metal-mouth" look from our high school days. For a long time, that was the only way to get a perfect smile. But at Pinnacle Dental Centre, we’ve seen a massive shift in how our patients approach orthodontics.</p>
            
            <p>Invisalign isn’t just a trendy alternative to braces; it is a total evolution in dental technology. Here is why clear aligners are quickly becoming the gold standard for the modern, busy Kenyan professional.</p>

            <h3 class="text-2xl font-bold text-dark mt-8 mb-4">It’s Virtually Invisible</h3>
            <p>The most obvious perk is right in the name. Whether you’re heading into a high-stakes board meeting at Sarit Centre or meeting friends for dinner in Westlands, you shouldn’t have to feel self-conscious about your smile. Invisalign aligners are made of a clear, medical-grade plastic that is nearly impossible to spot. You get the results without the "work-in-progress" look.</p>

            <h3 class="text-2xl font-bold text-dark mt-8 mb-4">Lifestyle Without Limits</h3>
            <p>Traditional braces come with a long list of "don'ts"—don't eat popcorn, don't chew gum, don't bite into an apple. With Invisalign, the aligners are removable.</p>
            <ul class="list-disc pl-6 space-y-2">
                <li><strong>Eat what you want:</strong> Just pop them out before meals.</li>
                <li><strong>Better Hygiene:</strong> You can brush and floss normally without navigating around wires and brackets.</li>
                <li><strong>Comfort:</strong> No more sharp metal poking your cheeks or lips. The smooth plastic is custom-molded to fit your mouth perfectly.</li>
            </ul>

            <h3 class="text-2xl font-bold text-dark mt-8 mb-4">Precision Meets Speed</h3>
            <p>The "Future" part of Invisalign comes down to the tech. We use advanced 3D imaging to map out your entire journey before you even start. You can actually see a digital preview of your final smile before the first tray even touches your teeth. Because the movements are planned with such precision, many patients find their treatment time is shorter than it would have been with traditional methods.</p>

            <h3 class="text-2xl font-bold text-dark mt-8 mb-4">Fewer Clinic Visits</h3>
            <p>We know your time is valuable. Traditional braces require frequent "tightening" appointments. Invisalign works through a series of trays that you swap out at home. This means fewer trips to the dentist and more time enjoying your life, with check-ins designed to fit your schedule.</p>

            <h3 class="text-2xl font-bold text-dark mt-8 mb-4">Is Invisalign Right for You?</h3>
            <p>Whether you're looking to close a small gap or correct a more complex bite issue, the technology has come a long way. At Pinnacle Dental Centre, we specialize in creating these premium, seamless transitions.</p>

            <p class="font-bold text-pinnacle mt-8">Ready to see what your future smile looks like? Click the Book Appointment button above or send us a quick message via the WhatsApp button to schedule your consultation at our Sarit Centre clinic.</p>
        `
    },
    {
        id: 'digital-imaging',
        title: 'The Role of Digital Imaging in Modern Implantology.',
        tag: 'Innovation',
        readTime: '8 Min Read',
        date: 'Feb 28, 2026',
        img: 'Digital Imaging.jpg',
        excerpt: 'How 3D scanning ensures precision and painless recovery for dental implant patients...',
        content: `
            <p>Modern dental implants are more predictable and comfortable than ever, thanks to advancements in digital imaging. At Pinnacle Dental Centre, we utilize the latest 3D scanning technology to plan every procedure with surgical precision.</p>
            <p>This article explores how digital workflows reduce surgery time and enhance the long-term success of dental restorations.</p>
        `
    },
    {
        id: 'hollywood-smile',
        title: 'Maintaining Your Hollywood Smile Post-Whitening.',
        tag: 'Wellness',
        readTime: '4 Min Read',
        date: 'Feb 20, 2026',
        img: 'Teeth Whitening.jpg',
        excerpt: 'Essential tips to keep your teeth sparkling long after your clinical whitening session...',
        content: `
            <p>You've achieved that dazzling white smile—now how do you keep it? Maintaining results requires a combination of good habits and occasional touch-ups.</p>
            <p>From diet choices to hygiene routines, we share the secrets to lasting radiance.</p>
        `
    }
];

function renderBlog() {
    const grid = document.getElementById('blog-grid');
    if (!grid) return;

    grid.innerHTML = BLOG_POSTS.map((post, i) => `
        <article class="bg-white rounded-[32px] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 group border border-gray-50">
            <div class="h-64 overflow-hidden relative">
                <img src="${post.img}" alt="${post.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700">
                <div class="absolute top-4 left-4">
                    <span class="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-md text-pinnacle shadow-sm">
                        ${post.tag}
                    </span>
                </div>
            </div>
            <div class="p-8 md:p-10 flex flex-col h-full">
                <div class="flex items-center gap-3 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-4">
                    <span>${post.date}</span>
                    <span class="w-1 h-1 bg-gray-200 rounded-full"></span>
                    <span>${post.readTime}</span>
                </div>
                <h3 class="text-xl md:text-2xl font-premium font-bold mb-4 group-hover:text-pinnacle transition-colors leading-tight">
                    ${post.title}
                </h3>
                <p class="text-gray-500 text-sm line-clamp-2 mb-8 leading-relaxed">
                    ${post.excerpt}
                </p>
                <button onclick="openBlogModal(${i})" class="mt-auto inline-flex items-center gap-2 text-xs font-bold text-dark hover:text-pinnacle transition-colors group/btn">
                    Read Full Story 
                    <div class="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center group-hover/btn:bg-pinnacle group-hover/btn:text-white transition-all">
                        <i data-lucide="arrow-right" class="w-4 h-4"></i>
                    </div>
                </button>
            </div>
        </article>
    `).join('');
    lucide.createIcons();
}


// ===== BEFORE & AFTER DATA =====
const COMPARISONS = [
    {
        title: "Invisalign Transformation",
        subtitle: "6 Months Treatment • Perfect Alignment",
        before: "Invisalign Treatment-before.jpg",
        after: "Invisalign Treatment-after.jpg",
        tag: "Invisalign"
    },
    {
        title: "Braces Transformation",
        subtitle: "18 Months • Corrective Orthodontics",
        before: "Braces Treatment-before.jpg",
        after: "Braces Treatment-after.jpg",
        tag: "Braces"
    },
    {
        title: "Teeth Whitening",
        subtitle: "Single Session • Ultimate Radiance",
        before: "teeth whitening-before.webp",
        after: "teeth whitening-after.webp",
        tag: "Whitening"
    },
    {
        title: "Dental Implant",
        subtitle: "Single Missing Tooth Restoration",
        before: "implant-before.jpg",
        after: "implant-after.jpg",
        tag: "Implants"
    },
    {
        title: "Crown Restoration",
        subtitle: "Porcelain Crown • Natural Aesthetics",
        before: "crown-before.jpg",
        after: "crown-after.jpg",
        tag: "Aesthetics"
    }
];

function renderComparisons() {
    const grid = document.getElementById('comparison-grid');
    if (!grid) return;

    grid.innerHTML = COMPARISONS.map((comp, i) => `
        <div class="space-y-6">
            <div class="comparison-container group shadow-2xl">
                <!-- After Image (Background) -->
                <div class="comparison-after w-full h-full">
                    <img src="${comp.after}" alt="${comp.title} - After" class="w-full h-full object-cover">
                </div>
                
                <!-- Before Image (Overlay) -->
                <div class="comparison-before w-full h-full" id="before-${i}" style="clip-path: inset(0 50% 0 0);">
                    <img src="${comp.before}" alt="${comp.title} - Before" class="w-full h-full object-cover">
                </div>
                
                <!-- Slider Line & Handle -->
                <div class="comparison-slider" id="slider-${i}" style="left: 50%;">
                    <div class="comparison-handle text-pinnacle shadow-xl">
                        <i data-lucide="split" class="w-6 h-6"></i>
                    </div>
                </div>

                <!-- Labels -->
                <div class="absolute top-6 left-6 z-30">
                    <span class="bg-white/90 backdrop-blur-md px-4 py-2 rounded-full text-[10px] font-bold text-pinnacle uppercase tracking-[0.2em] shadow-sm">Before</span>
                </div>
                <div class="absolute top-6 right-6 z-30">
                    <span class="bg-pinnacle/90 backdrop-blur-md px-4 py-2 rounded-full text-[10px] font-bold text-white uppercase tracking-[0.2em] shadow-sm">After</span>
                </div>

                <!-- Hover Info Overlay -->
                <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-dark/90 via-dark/40 to-transparent p-10 text-white translate-y-full group-hover:translate-y-0 transition-transform duration-700 z-30">
                    <span class="text-[10px] font-bold text-seafoam uppercase tracking-widest mb-3 block">${comp.tag}</span>
                    <h4 class="text-2xl font-bold mb-2">${comp.title}</h4>
                    <p class="text-sm text-gray-300">${comp.subtitle}</p>
                </div>
            </div>
        </div>
    `).join('');

    lucide.createIcons();
    initComparisonSliders();
}

function initComparisonSliders() {
    const containers = document.querySelectorAll('.comparison-container');

    containers.forEach(container => {
        const before = container.querySelector('.comparison-before');
        const slider = container.querySelector('.comparison-slider');

        let isDragging = false;

        const move = (e) => {
            if (!isDragging) return;

            const rect = container.getBoundingClientRect();
            let x = (e.pageX || (e.touches ? e.touches[0].pageX : 0)) - rect.left;

            // Boundary checks
            if (x < 0) x = 0;
            if (x > rect.width) x = rect.width;

            const percentage = (x / rect.width) * 100;

            before.style.clipPath = `inset(0 ${100 - percentage}% 0 0)`;
            slider.style.left = `${percentage}%`;
        };

        const startDragging = () => isDragging = true;
        const stopDragging = () => isDragging = false;

        slider.addEventListener('mousedown', startDragging);
        container.addEventListener('touchstart', startDragging, { passive: true });

        window.addEventListener('mousemove', move);
        window.addEventListener('touchmove', move, { passive: false });

        window.addEventListener('mouseup', stopDragging);
        window.addEventListener('touchend', stopDragging);
    });
}

function openBlogModal(index) {
    const post = BLOG_POSTS[index];
    const modal = document.getElementById('blog-modal');

    document.getElementById('blog-modal-img').src = post.img;
    document.getElementById('blog-modal-title').textContent = post.title;
    document.getElementById('blog-modal-tag').textContent = post.tag;
    document.getElementById('blog-modal-date').textContent = post.date;
    document.getElementById('blog-modal-content').innerHTML = post.content;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';
    lucide.createIcons();
}

function closeBlogModal() {
    const modal = document.getElementById('blog-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.style.overflow = '';
}

// Wire modal close actions
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('modal-close')?.addEventListener('click', closeServiceModal);
    document.getElementById('modal-overlay')?.addEventListener('click', closeServiceModal);
    // Close on ESC key
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeServiceModal(); });
});

// 1. Product Data

const PRODUCTS = [
    {
        id: 1,
        name: "Bitvae C6 Water Dental Flosser",
        price: 7000,
        desc: "Cordless flosser for travel with 6 jet tips, 3 modes, 5 intensities, IPX7 waterproof and rechargeable oral irrigator cleaner.",
        availability: "In Stock",
        delivery: "Get it delivered within One Business day.",
        images: [
            "Bitvae C6 Water Dental Flosser.jpg",
            "Bitvae C6 Water Dental Flosser1.jpg",
            "Bitvae C6 Water Dental Flosser2.jpg",
            "Bitvae C6 Water Dental Flosser3.jpg",
            "Bitvae C6 Water Dental Flosser4.jpg"
        ],
        features: [
            "6 Replacement Jet Tips",
            "3 Modes & 5 Intensities",
            "IPX7 Waterproof Design",
            "Rechargeable (Long Battery Life)",
            "Travel-Friendly Cordless Design"
        ]
    },
    {
        id: 2,
        name: "Bitvae R2 Rotating Electric Toothbrush",
        price: 7000,
        desc: "Rechargeable power toothbrush with 8 brush heads, travel case, 5 modes and pressure sensor. Fast charge in 3 hours for 30 days use.",
        availability: "In Stock",
        delivery: "Get it delivered within One Business day.",
        images: [
            "Bitvae R2 Rotating Electric Toothbrush1.jpg",
            "Bitvae R2 Rotating Electric Toothbrush2.jpg",
            "Bitvae R2 Rotating Electric Toothbrush3.jpg",
            "Bitvae R2 Rotating Electric Toothbrush4.jpg"
        ],
        features: [
            "8 Brush Heads Included",
            "Travel Case Included",
            "5 Brushing Modes",
            "Built-in Pressure Sensor",
            "Fast Charge (3 Hrs) for 30 Days Use"
        ]
    },
    {
        id: 3,
        name: "Cordless Portable Water Flosser",
        price: 6000,
        desc: "Rechargeable oral irrigator with 4 modes, 4 tips, powerful battery life, IPX7 waterproof, ideal for home and travel.",
        availability: "In Stock",
        delivery: "Get it delivered within One Business day.",
        images: [
            "Cordless Portable Water Flosser1.jpg",
            "Cordless Portable Water Flosser2.jpg",
            "Cordless Portable Water Flosser3.jpg",
            "Cordless Portable Water Flosser4.jpg"
        ],
        features: [
            "4 Cleaning Modes",
            "4 Replacement Tips",
            "Powerful Battery Life",
            "IPX7 Waterproof",
            "Ideal for Home and Travel"
        ]
    },
    {
        id: 4,
        name: "Bitvae Smart K7s Kids Sonic Electric Toothbrush",
        price: 8000,
        desc: "The Bitvae Kids Bluetooth electric toothbrush is made for children ages 4+ and uses a free app iSpruz which educates kids and establishes healthy brushing habits. Some Features are pressure Sensor to protect Gums with 3 Modes 2 Intensities, USB rechargeable and battery life will last up to 100 days. Package Includes: 1 Bitvae K7S Toothbrush Handle, 4 Toothbrush Heads, 1 USB Cable and Instruction Manual.",
        availability: "In Stock",
        delivery: "Get it delivered within One Business day.",
        images: [
            "Bitvae Smart K7s Kids Sonic Electric Toothbrush1.jpg",
            "Bitvae Smart K7s Kids Sonic Electric Toothbrush2.jpg",
            "Bitvae Smart K7s Kids Sonic Electric Toothbrush3.jpg",
            "Bitvae Smart K7s Kids Sonic Electric Toothbrush4.jpg"
        ],
        features: [
            "Free iSpruz Educational App",
            "Pressure Sensor (3 Modes & 2 Intensities)",
            "USB Rechargeable (100 Days Battery Life)",
            "4 Toothbrush Heads Included"
        ]
    },
    {
        id: 5,
        name: "Curaprox Be You Watermelon Toothpaste",
        price: 1500,
        desc: "Daily whitening toothpaste with watermelon flavor. Designed for gum health and fresh breath. Vegan and fluoride-based.",
        availability: "In Stock",
        delivery: "Get it delivered within One Business day.",
        images: [
            "Curaprox Be You Watermelon Toothpaste1.jpg",
            "Curaprox Be You Watermelon Toothpaste2.jpg",
            "Curaprox Be You Watermelon Toothpaste3.jpg",
            "Curaprox Be You Watermelon Toothpaste4.jpg"
        ],
        features: [
            "Watermelon Flavor",
            "Designed for Gum Health",
            "Daily Whitening Formula",
            "Vegan & Fluoride-Based",
            "Promotes Fresh Breath"
        ]
    },
    {
        id: 6,
        name: "Remidin Chlorhexidine Mouthwash",
        price: 500,
        desc: "Antibacterial mouthwash for use after deep cleaning like scaling and root planing. Helps prevent gum disease. May stain teeth.",
        availability: "In Stock",
        delivery: "Get it delivered within One Business day.",
        images: [
            "Remidin Chlorhexidine Mouthwash1.jpg"
        ],
        features: [
            "Antibacterial Agent",
            "Prevents Gum Disease",
            "Ideal for Post-Cleaning/Scaling",
            "Notice: May cause temporary teeth staining"
        ]
    }
];

// 2. Cart Logic
let cart = JSON.parse(localStorage.getItem('pinnacle_cart')) || [];

function updateCartUI() {
    const list = document.getElementById('cart-items');
    const totalEl = document.getElementById('cart-total');
    const countEl = document.getElementById('cart-count');

    if (!list) return; // Not on shop page

    list.innerHTML = cart.length === 0 ? '<p class="text-center text-gray-400 py-20">Your cart is empty</p>' : '';

    let total = 0;
    cart.forEach((item, index) => {
        total += item.price * (item.quantity || 1);
        const imgSrc = item.images && item.images.length > 0 ? item.images[0] : item.img;

        const div = document.createElement('div');
        div.className = 'flex gap-4 items-center bg-gray-50 p-4 rounded-2xl';
        div.innerHTML = `
            <div class="w-16 h-16 bg-white rounded-xl overflow-hidden shrink-0">
                <img src="${imgSrc}" class="w-full h-full object-cover">
            </div>
            <div class="flex-grow">
                <h4 class="font-bold text-sm leading-tight">${item.name}</h4>
                <p class="text-xs text-gray-500 mt-1">Qty: ${item.quantity || 1}</p>
                <p class="text-pinnacle font-bold text-xs mt-1">Ksh ${(item.price * (item.quantity || 1)).toLocaleString()}</p>
            </div>
            <button onclick="removeFromCart(${index})" class="text-gray-300 hover:text-red-500"><i data-lucide="trash-2" class="w-5 h-5"></i></button>
        `;
        list.appendChild(div);
    });

    totalEl.innerText = `Ksh ${total.toLocaleString()}`;
    countEl.innerText = cart.length;
    lucide.createIcons();
    localStorage.setItem('pinnacle_cart', JSON.stringify(cart));
}

function addToCart(productId, quantity = 1) {
    const product = PRODUCTS.find(p => p.id === productId);

    // Check if item already in cart
    const existingItemIndex = cart.findIndex(item => item.id === productId);

    if (existingItemIndex > -1) {
        cart[existingItemIndex].quantity += quantity;
    } else {
        // Create a copy so we don't mutate the original product data
        const cartItem = { ...product, quantity: quantity };
        cart.push(cartItem);
    }

    updateCartUI();
    toggleCart(true);
}

function removeFromCart(index) {
    cart.splice(index, 1);
    updateCartUI();
}

function toggleCart(show) {
    const overlay = document.getElementById('cart-overlay');
    const sidebar = document.getElementById('cart-sidebar');
    if (!overlay) return;

    if (show) {
        overlay.classList.remove('hidden');
        setTimeout(() => sidebar.classList.remove('translate-x-full'), 10);
    } else {
        sidebar.classList.add('translate-x-full');
        setTimeout(() => overlay.classList.add('hidden'), 300);
    }
}

// 3. Shop Rendering
function renderProducts() {
    const grid = document.getElementById('product-grid');
    if (!grid) return;

    grid.innerHTML = PRODUCTS.map(p => `
        <div class="group relative bg-white rounded-[32px] overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-700 border border-gray-100 flex flex-col h-full transform hover:-translate-y-2">
            <div class="relative aspect-[4/5] bg-gray-50 overflow-hidden cursor-pointer" onclick="openProductModal(${p.id})">
                <img src="${p.images[0]}" alt="${p.name}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 ease-out">
                
                <!-- Premium Overlay on Hover -->
                <div class="absolute inset-0 bg-gradient-to-t from-dark/90 via-dark/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                
                <!-- Price Badge -->
                <div class="absolute top-6 right-6 bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg transform translate-y-0 group-hover:-translate-y-1 transition-transform duration-500 z-10">
                    <span class="text-sm font-bold text-pinnacle tracking-wide">Ksh ${p.price.toLocaleString()}</span>
                </div>

                <!-- Add to Cart (Slide up on hover) -->
                <div class="absolute inset-x-0 bottom-0 p-6 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out z-20 flex justify-center">
                    <button onclick="event.stopPropagation(); addToCart(${p.id}, 1)" class="w-full bg-seafoam text-white py-4 rounded-2xl font-bold font-premium hover:bg-teal transition-colors shadow-xl shadow-seafoam/30 flex items-center justify-center gap-2">
                        Quick Add <i data-lucide="shopping-bag" class="w-5 h-5"></i>
                    </button>
                </div>
            </div>
            
            <!-- Details -->
            <div class="p-8 flex flex-col flex-grow bg-white relative z-10 cursor-pointer" onclick="openProductModal(${p.id})">
                <div class="flex justify-between items-start mb-4">
                    <h3 class="text-xl font-premium font-bold text-dark leading-tight group-hover:text-pinnacle transition-colors">${p.name}</h3>
                </div>
                <!-- Mini subtle divider -->
                <div class="w-10 h-1 bg-gradient-to-r from-seafoam to-pinnacle rounded-full mb-4"></div>
                <p class="text-gray-500 text-sm leading-relaxed flex-grow">${p.desc}</p>
            </div>
        </div>
    `).join('');
    lucide.createIcons();
}

// 4. WhatsApp Checkout
function handleCheckout() {
    if (cart.length === 0) return alert('Your cart is empty!');

    let message = `*NEW ORDER - PINNACLE SHOP*\n\n`;
    let total = 0;
    cart.forEach((item, index) => {
        const itemTotal = item.price * item.quantity;
        message += `${index + 1}. ${item.quantity}x ${item.name} - Ksh ${itemTotal.toLocaleString()}\n`;
        total += itemTotal;
    });
    message += `\n*TOTAL: Ksh ${total.toLocaleString()}*\n`;
    message += `\n--- Customer Details ---\nKindly fill your details:\nName:\nLocation:\nContact:`;

    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/254706076636?text=${encoded}`, '_blank');
}

// 5. Product Modal Logic
let currentModalProductId = null;
let currentModalQuantity = 1;

window.openProductModal = function (productId) {
    const p = PRODUCTS.find(item => item.id === productId);
    if (!p) return;

    currentModalProductId = p.id;
    currentModalQuantity = 1; // Reset quantity

    // Populate Data
    document.getElementById('pm-name').innerText = p.name;
    document.getElementById('pm-desc').innerText = p.desc;
    document.getElementById('pm-price').innerText = `Ksh ${p.price.toLocaleString()}`;
    document.getElementById('pm-availability').innerText = p.availability;
    document.getElementById('pm-delivery').innerText = p.delivery;

    // Initial calculation
    updateModalTotal();

    // Features List
    const featList = document.getElementById('pm-features');
    featList.innerHTML = p.features.map(f => `
        <li class="flex items-center gap-3 text-gray-600">
            <i data-lucide="check-circle-2" class="w-5 h-5 text-seafoam shrink-0"></i>
            <span>${f}</span>
        </li>
    `).join('');

    // Main Image
    document.getElementById('pm-main-img').src = p.images[0];

    // Thumbnails
    const thumbContainer = document.getElementById('pm-thumbnails');
    if (p.images.length > 1) {
        thumbContainer.classList.remove('hidden');
        thumbContainer.classList.add('flex');
        thumbContainer.innerHTML = p.images.map((img, index) => `
            <button onclick="setModalMainImage('${img}')" class="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border-2 border-transparent hover:border-pinnacle transition-all focus:outline-none shrink-0 shadow-sm hover:shadow-md">
                <img src="${img}" class="w-full h-full object-cover">
            </button>
        `).join('');
    } else {
        thumbContainer.classList.add('hidden');
        thumbContainer.classList.remove('flex');
    }

    // Show Modal
    const modal = document.getElementById('product-modal');
    modal.classList.remove('hidden');
    // slight delay to allow display block to process before opacity transition
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        document.getElementById('product-modal-panel').classList.remove('translate-y-8', 'opacity-0');
        document.getElementById('product-modal-panel').classList.add('translate-y-0', 'opacity-100');
    }, 10);

    document.body.style.overflow = 'hidden';
    lucide.createIcons();
}

window.closeProductModal = function () {
    const modal = document.getElementById('product-modal');
    const panel = document.getElementById('product-modal-panel');

    panel.classList.remove('translate-y-0', 'opacity-100');
    panel.classList.add('translate-y-8', 'opacity-0');
    modal.classList.add('opacity-0');

    setTimeout(() => {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
    }, 300);
}

window.setModalMainImage = function (src) {
    document.getElementById('pm-main-img').src = src;
}

window.updateModalQuantity = function (change) {
    currentModalQuantity += change;
    if (currentModalQuantity < 1) currentModalQuantity = 1;
    if (currentModalQuantity > 10) currentModalQuantity = 10;

    document.getElementById('pm-quantity').innerText = currentModalQuantity;
    updateModalTotal();
}

function updateModalTotal() {
    const p = PRODUCTS.find(item => item.id === currentModalProductId);
    const total = p.price * currentModalQuantity;
    document.getElementById('pm-total').innerText = `Ksh ${total.toLocaleString()}`;
}

window.addModalItemToCart = function () {
    addToCart(currentModalProductId, currentModalQuantity);
    window.closeProductModal();
}

// 5. Booking Form Handling
const bookingForm = document.getElementById('booking-form');
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbw4cft8uDGPy8hjZwfmC-B5eD6gR7LWyaD81cYXCZ93g-dKNsqCpfoh7tFSTKNCf2Mr/exec';

if (bookingForm) {
    bookingForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = bookingForm.querySelector('button[type="submit"]');
        if (!submitBtn) return;
        
        const originalBtnText = submitBtn.innerHTML;
        
        // Disable button and show loading state
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="lucide-loader-2 animate-spin"></i> Processing...';
        if (window.lucide) lucide.createIcons();

        const formData = new FormData(bookingForm);
        const data = {
            action: 'createBooking',
            name: formData.get('name'),
            phone: formData.get('phone'),
            service: formData.get('service'),
            date: formData.get('date'),
            message: formData.get('message') || ''
        };

        try {
            console.log('Submitting booking:', data);
            
            // Note: Google Apps Script redirection requires handling or no-cors
            // Using standard fetch. If CORS issues persist, we might need a different approach.
            const response = await fetch(WEB_APP_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            // Since mode is 'no-cors', we assume success if no error is thrown
            alert('Success! Your booking request has been sent. Our team will contact you to finalize the time slot.');
            bookingForm.reset();

        } catch (error) {
            console.error('Submission Error:', error);
            alert('There was an error processing your booking. Please try again or call us directly.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
            if (window.lucide) lucide.createIcons();
        }
    });
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Initial Render
    renderServices();
    renderBlog();
    renderComparisons();
    renderProducts();
    updateCartUI();

    // Modal Close Events
    document.getElementById('modal-close')?.addEventListener('click', closeServiceModal);
    document.getElementById('service-overlay')?.addEventListener('click', closeServiceModal);

    document.getElementById('blog-modal-close')?.addEventListener('click', closeBlogModal);
    document.getElementById('blog-overlay')?.addEventListener('click', closeBlogModal);

    // Global ESC key for modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeServiceModal();
            closeBlogModal();
            if (typeof window.closeProductModal === 'function') window.closeProductModal();
            toggleCart(false);
        }
    });

    // Product Modal Close Events
    document.getElementById('pm-close')?.addEventListener('click', window.closeProductModal);
    document.getElementById('pm-overlay')?.addEventListener('click', window.closeProductModal);

    const cartToggle = document.getElementById('cart-toggle');
    const cartHide = document.getElementById('cart-hide');
    const checkoutBtn = document.getElementById('checkout-btn');
    const cartClose = document.getElementById('cart-close');

    if (cartToggle) cartToggle.onclick = () => toggleCart(true);
    if (cartHide) cartHide.onclick = () => toggleCart(false);
    if (cartClose) cartClose.onclick = () => toggleCart(false);
    if (checkoutBtn) checkoutBtn.onclick = handleCheckout;
});
