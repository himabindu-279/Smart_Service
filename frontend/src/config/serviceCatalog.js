const photo = (id) => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=960`;

export const serviceCatalog = [
  {
    slug: 'home-services',
    backendCategorySlug: 'home-services',
    title: 'Home Services',
    description: 'Trusted help for repairs, maintenance, and a more comfortable home.',
    image: photo(5691622),
    imageAlt: 'Home repair professional working on a household fixture',
    tasks: [
      { title: 'Pipe Leakage Repair', slug: 'pipe-leakage-repair', serviceSlug: 'plumbing', description: 'Find and repair leaking pipes, joints, and connections.', image: photo(5691659), imageAlt: 'Plumber repairing pipework' },
      { title: 'Tap Repair', slug: 'tap-repair', serviceSlug: 'plumbing', description: 'Fix dripping taps and replace worn tap fittings.', image: photo(5691635), imageAlt: 'Close-up of plumbing fixture repair' },
      { title: 'Drain Cleaning', slug: 'drain-cleaning', serviceSlug: 'plumbing', description: 'Clear slow or blocked household drains.', image: photo(5691668), imageAlt: 'Professional clearing a household drain' },
      { title: 'Fan Repair', slug: 'fan-repair', serviceSlug: 'electrical', description: 'Repair ceiling fans, regulators, and fan wiring.', image: photo(5691628), imageAlt: 'Electrician repairing a home fixture' },
      { title: 'Wiring Repair', slug: 'wiring-repair', serviceSlug: 'electrical', description: 'Diagnose and repair household wiring faults.', image: photo(5691641), imageAlt: 'Electrician inspecting household wiring' },
      { title: 'Switch Repair', slug: 'switch-repair', serviceSlug: 'electrical', description: 'Repair or replace faulty switches and sockets.', image: photo(5691652), imageAlt: 'Electrician working on a wall switch' },
      { title: 'AC Repair', slug: 'ac-repair-task', serviceSlug: 'ac-repair', description: 'Troubleshoot cooling issues and restore AC performance.', image: photo(4279006), imageAlt: 'Technician servicing an air conditioner' },
      { title: 'AC Installation', slug: 'ac-installation-task', serviceSlug: 'ac-installation', description: 'Install and test split or window air conditioners.', image: photo(4483774), imageAlt: 'Air conditioning unit installation' },
      { title: 'AC Maintenance', slug: 'ac-maintenance-task', serviceSlug: 'ac-maintenance', description: 'Schedule preventive cleaning and AC inspection.', image: photo(4108715), imageAlt: 'Technician maintaining an air conditioning unit' },
      { title: 'Deep Cleaning', slug: 'deep-cleaning', serviceSlug: 'cleaning', description: 'Refresh your home with a detailed deep clean.', image: photo(4239031), imageAlt: 'Professional cleaning a bright home' },
      { title: 'Bathroom Cleaning', slug: 'bathroom-cleaning', serviceSlug: 'cleaning', description: 'Detailed cleaning for bathroom surfaces and fittings.', image: photo(4239146), imageAlt: 'Freshly cleaned bathroom' },
      { title: 'Kitchen Cleaning', slug: 'kitchen-cleaning', serviceSlug: 'cleaning', description: 'Clean kitchen counters, surfaces, and hard-to-reach areas.', image: photo(4107120), imageAlt: 'Cleaner wiping a kitchen counter' },
      { title: 'Pest Treatment', slug: 'pest-treatment', serviceSlug: 'pest-control', description: 'Arrange professional treatment for common household pests.', image: photo(5691655), imageAlt: 'Home maintenance specialist inspecting a room' },
    ],
  },
  {
    slug: 'food-services',
    backendCategorySlug: 'food-services',
    title: 'Food Services',
    description: 'Local cooks, caterers, and bakers for everyday meals and occasions.',
    image: photo(958545),
    imageAlt: 'Freshly prepared meal served at a table',
    tasks: [
      { title: 'Event Catering', slug: 'event-catering', serviceSlug: 'catering', description: 'Food service for celebrations, gatherings, and events.', image: photo(5638732), imageAlt: 'Catered food prepared for an event' },
      { title: 'Home-Cooked Meals', slug: 'home-cooked-meals', serviceSlug: 'home-food', description: 'Enjoy comforting meals prepared by local home cooks.', image: photo(1640777), imageAlt: 'Home-cooked meal ready to serve' },
      { title: 'Custom Cakes', slug: 'custom-cakes', serviceSlug: 'baker', description: 'Order custom cakes and baked treats for special moments.', image: photo(291528), imageAlt: 'Decorated cake prepared by a baker' },
      { title: 'Meal Plans', slug: 'meal-plans', serviceSlug: 'meal-services', description: 'Explore recurring meal options from local providers.', image: photo(376464), imageAlt: 'Balanced prepared meal plan' },
    ],
  },
  {
    slug: 'healthcare',
    backendCategorySlug: 'healthcare',
    title: 'Healthcare Services',
    description: 'Connect with healthcare professionals and convenient home services.',
    image: photo(5327585),
    imageAlt: 'Healthcare professional speaking with a patient',
    tasks: [
      { title: 'Doctor Consultation', slug: 'doctor-consultation-task', serviceSlug: 'doctor-consultation', description: 'Book a consultation with a healthcare professional.', image: photo(5327585), imageAlt: 'Doctor consulting with a patient' },
      { title: 'Nursing at Home', slug: 'nursing-at-home', serviceSlug: 'nurse-at-home', description: 'Arrange in-home nursing and patient support.', image: photo(7659562), imageAlt: 'Nurse providing attentive patient care' },
      { title: 'Physiotherapy', slug: 'physiotherapy-task', serviceSlug: 'physiotherapy', description: 'Find support for mobility, recovery, and guided exercises.', image: photo(6111616), imageAlt: 'Physiotherapist guiding a patient through an exercise' },
      { title: 'Lab Sample Collection', slug: 'lab-sample-collection', serviceSlug: 'lab-services', description: 'Arrange convenient sample collection and diagnostics.', image: photo(5452201), imageAlt: 'Healthcare worker preparing a diagnostic sample' },
    ],
  },
  {
    slug: 'education',
    backendCategorySlug: 'education',
    title: 'Education Services',
    description: 'Personalized tutoring and coaching to help learners make progress.',
    image: photo(5212321),
    imageAlt: 'Tutor helping a learner study',
    tasks: [
      { title: 'School Tutoring', slug: 'school-tutoring', serviceSlug: 'tutors', description: 'One-to-one tutoring for school subjects and coursework.', image: photo(8613089), imageAlt: 'Student learning with a tutor' },
      { title: 'Programming Lessons', slug: 'programming-lessons', serviceSlug: 'programming', description: 'Learn coding with guidance from a programming tutor.', image: photo(574071), imageAlt: 'Learner practicing programming on a laptop' },
      { title: 'Math Tutoring', slug: 'math-tutoring', serviceSlug: 'mathematics', description: 'Get help with mathematics, from foundations to exam prep.', image: photo(6238038), imageAlt: 'Student working through mathematics exercises' },
      { title: 'English and Test Prep', slug: 'english-test-prep', serviceSlug: 'english', description: 'Build English fluency and prepare for language tests.', image: photo(5905445), imageAlt: 'English tutor teaching a student' },
    ],
  },
  {
    slug: 'automotive',
    backendCategorySlug: 'automotive',
    title: 'Automotive Services',
    description: 'Find local mechanics for vehicle repair, servicing, and maintenance.',
    image: photo(3807329),
    imageAlt: 'Mechanic inspecting a vehicle in a workshop',
    tasks: [
      { title: 'Car Repair', slug: 'car-repair-task', serviceSlug: 'car-repair', description: 'Get professional help diagnosing and repairing a car.', image: photo(4489734), imageAlt: 'Mechanic repairing a car' },
      { title: 'Bike Repair', slug: 'bike-repair-task', serviceSlug: 'bike-repair', description: 'Arrange repairs and maintenance for your two-wheeler.', image: photo(3807329), imageAlt: 'Motorcycle mechanic working in a garage' },
      { title: 'Vehicle Servicing', slug: 'vehicle-servicing', serviceSlug: 'servicing', description: 'Book routine vehicle maintenance and inspection.', image: photo(6870300), imageAlt: 'Vehicle undergoing service in a workshop' },
    ],
  },
  {
    slug: 'appliance-repair',
    backendCategorySlug: 'appliance-repair',
    title: 'Appliance Repair',
    description: 'Book a technician for everyday kitchen and home appliances.',
    image: photo(4108715),
    imageAlt: 'Technician repairing a household appliance',
    tasks: [
      { title: 'Refrigerator Repair', slug: 'refrigerator-repair', serviceSlug: 'refrigerator-repair', description: 'Troubleshoot cooling, leaks, and common refrigerator faults.', image: photo(5591666), imageAlt: 'Technician inspecting a refrigerator' },
      { title: 'Washing Machine Repair', slug: 'washing-machine-repair', serviceSlug: 'washing-machine-repair', description: 'Get help with washing machine drainage, spin, or power issues.', image: photo(5591663), imageAlt: 'Technician inspecting a washing machine' },
      { title: 'Microwave Repair', slug: 'microwave-repair', serviceSlug: 'microwave-repair', description: 'Arrange repair for microwave heating and control problems.', image: photo(5591664), imageAlt: 'Microwave appliance being serviced' },
      { title: 'Dishwasher Repair', slug: 'dishwasher-repair', serviceSlug: 'dishwasher-repair', description: 'Get support for dishwasher cleaning and drainage faults.', image: photo(5591665), imageAlt: 'Technician repairing a dishwasher' },
    ],
  },
  {
    slug: 'beauty-personal-care',
    backendCategorySlug: 'beauty-personal-care',
    title: 'Beauty and Personal Care',
    description: 'Discover local professionals for grooming and personal care.',
    image: photo(3993449),
    imageAlt: 'Beauty professional providing a salon service',
    tasks: [
      { title: 'Haircut and Styling', slug: 'haircut-styling', serviceSlug: 'haircut-styling', description: 'Book professional hair styling and haircut services.', image: photo(3993449), imageAlt: 'Hair stylist working with a client' },
      { title: 'Makeup Artist', slug: 'makeup-artist', serviceSlug: 'makeup-artist', description: 'Find makeup services for events and celebrations.', image: photo(3764011), imageAlt: 'Makeup artist preparing a client' },
      { title: 'Manicure and Pedicure', slug: 'manicure-pedicure', serviceSlug: 'manicure-pedicure', description: 'Arrange nail grooming and care with a local specialist.', image: photo(3997989), imageAlt: 'Nail care service in a salon' },
      { title: 'Skin Care', slug: 'skin-care', serviceSlug: 'skin-care', description: 'Explore personal care and skin treatment services.', image: photo(3738347), imageAlt: 'Personal care professional offering a facial treatment' },
    ],
  },
  {
    slug: 'moving-services',
    backendCategorySlug: 'moving-services',
    title: 'Moving Services',
    description: 'Plan a smoother move with help packing, lifting, and relocating.',
    image: photo(7464230),
    imageAlt: 'Moving boxes prepared for a home relocation',
    tasks: [
      { title: 'Home Relocation', slug: 'home-relocation', serviceSlug: 'home-relocation', description: 'Get help moving household belongings to a new home.', image: photo(7464230), imageAlt: 'Packed boxes ready for a home move' },
      { title: 'Packing and Unpacking', slug: 'packing-unpacking', serviceSlug: 'packing-unpacking', description: 'Arrange careful packing and unpacking assistance.', image: photo(4246120), imageAlt: 'Moving professional packing household items' },
      { title: 'Furniture Moving', slug: 'furniture-moving', serviceSlug: 'furniture-moving', description: 'Get assistance moving and handling furniture safely.', image: photo(7464687), imageAlt: 'Movers carrying furniture during relocation' },
    ],
  },
];

export const getServiceCategory = (slug) => serviceCatalog.find((category) => category.slug === slug);

export const getServiceTask = (serviceSlug, taskSlug) => serviceCatalog
  .flatMap((category) => category.tasks)
  .find((task) => task.serviceSlug === serviceSlug && task.slug === taskSlug);
