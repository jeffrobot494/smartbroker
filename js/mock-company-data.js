// Mock data for company information table
const mockCompanyData = [
    {
        company: "Acme Software Solutions",
        domain: "acmesoftware.com",
        linkedin: "linkedin.com/company/acme-software",
        contact: "John Smith",
        contactPosition: "CEO",
        softwareProduct: "",
        employees: "",
        usEmployees: "",
        bootstrapped: "",
        verticalMarket: "",
        ownerAge: ""
    },
    {
        company: "DataMaster Inc.",
        domain: "datamaster.tech",
        linkedin: "linkedin.com/company/datamaster",
        contact: "Sarah Johnson",
        contactPosition: "Founder",
        softwareProduct: "",
        employees: "",
        usEmployees: "",
        bootstrapped: "",
        verticalMarket: "",
        ownerAge: ""
    },
    {
        company: "CloudTech Services",
        domain: "cloudtechservices.net",
        linkedin: "linkedin.com/company/cloudtech-services",
        contact: "Michael Brown",
        contactPosition: "President",
        softwareProduct: "",
        employees: "",
        usEmployees: "",
        bootstrapped: "",
        verticalMarket: "",
        ownerAge: ""
    },
    {
        company: "HealthSoft Systems",
        domain: "healthsoftsystems.com",
        linkedin: "linkedin.com/company/healthsoft",
        contact: "Jessica Williams",
        contactPosition: "CEO",
        softwareProduct: "",
        employees: "",
        usEmployees: "",
        bootstrapped: "",
        verticalMarket: "",
        ownerAge: ""
    },
    {
        company: "EduTech Solutions",
        domain: "edutechsolutions.org",
        linkedin: "linkedin.com/company/edutech-solutions",
        contact: "Robert Davis",
        contactPosition: "Founder & CEO",
        softwareProduct: "",
        employees: "",
        usEmployees: "",
        bootstrapped: "",
        verticalMarket: "",
        ownerAge: ""
    }
];

// Generate additional mock data to reach 100 rows
const companyNames = [
    "Apex Technologies", "Bright Systems", "Cyber Solutions", "Digital Dynamics", "Evergreen Software",
    "Future Tech", "Global Systems", "Horizon Apps", "Insight Software", "Junction Solutions",
    "Keystone Technologies", "Logical Systems", "Momentum Software", "Nexus Technologies", "Optimum Solutions",
    "Precision Software", "Quantum Technologies", "Reliable Systems", "Streamline Solutions", "Triad Software",
    "Unity Technologies", "Venture Systems", "Wavelength Software", "Xenith Solutions", "Yellowstone Technologies",
    "Zenith Systems", "Automation Pro", "Byte Perfect", "CodeMasters", "DataFlow Systems",
    "Enterprise Solutions", "Fusion Software", "Gateway Systems", "Harbor Technologies", "Infinite Software",
    "Junction Point", "Kinetic Systems", "Latitude Software", "Matrix Solutions", "Northern Technologies",
    "Omega Systems", "Pacific Software", "Quadrant Technologies", "Radius Systems", "Sapphire Software",
    "Titan Technologies", "Unified Systems", "Velocity Software", "Westward Solutions", "Xcelerate Technologies"
];

const domains = [".com", ".net", ".org", ".tech", ".io", ".co", ".software", ".solutions", ".systems", ".technologies"];
const positions = ["CEO", "CTO", "Founder", "President", "Founder & CEO", "Chief Architect", "Owner", "Managing Director"];
const firstNames = ["John", "Mary", "James", "Patricia", "Robert", "Jennifer", "Michael", "Linda", "William", "Elizabeth", 
                   "David", "Susan", "Richard", "Jessica", "Joseph", "Sarah", "Thomas", "Karen", "Charles", "Nancy"];
const lastNames = ["Smith", "Johnson", "Williams", "Jones", "Brown", "Davis", "Miller", "Wilson", "Moore", "Taylor", 
                  "Anderson", "Thomas", "Jackson", "White", "Harris", "Martin", "Thompson", "Garcia", "Martinez", "Robinson"];

// Generate random Boolean values with YES/NO strings weighted toward YES (70% chance)
function randomYesNo() {
    return Math.random() < 0.7 ? "YES" : "NO";
}

// Generate the additional mock data
for (let i = 0; i < 95; i++) {
    const companyName = companyNames[i % companyNames.length] + " " + (Math.floor(i / companyNames.length) + 1);
    const domainName = companyName.toLowerCase().replace(/\s+/g, "") + domains[i % domains.length];
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const contactName = firstName + " " + lastName;
    const position = positions[Math.floor(Math.random() * positions.length)];
    
    mockCompanyData.push({
        company: companyName,
        domain: domainName,
        linkedin: "linkedin.com/company/" + domainName.split('.')[0],
        contact: contactName,
        contactPosition: position,
        softwareProduct: "",
        employees: "",
        usEmployees: "",
        bootstrapped: "",
        verticalMarket: "",
        ownerAge: ""
    });
}