"""
Cybersecurity Trivia and Incident Response Database
Curated for internal company events, covering realistic security concepts,
threats, incident response, passwords, social engineering, and network defenses.
"""

CYBER_TRIVIA = [
    {
        "id": 1,
        "category": "Social Engineering",
        "question": "You receive an urgent email from 'support@it-company-portal.co' asking you to update your corporate password immediately via a link. What should you do?",
        "options": [
            "Click the link immediately to prevent your account from being locked",
            "Forward the email to all colleagues to check if they received it too",
            "Report it to the SOC / Security Team and do not click any links",
            "Reply with your current password asking if it's already updated"
        ],
        "correct": 2,
        "explanation": "This is a classic phishing lure using urgency and domain spoofing. Always report suspicious emails directly to the SOC.",
        "buff": {"name": "Firewall Reinforcement", "effect": "guard_restore", "value": 50}
    },
    {
        "id": 2,
        "category": "Authentication",
        "question": "What is the primary vulnerability of SMS-based Multi-Factor Authentication (MFA) compared to Authenticator apps or hardware keys?",
        "options": [
            "SMS takes too long to arrive",
            "SMS is vulnerable to SIM Swapping and SS7 interception",
            "Smartphones cannot receive SMS in corporate buildings",
            "SMS requires an active VPN connection to function"
        ],
        "correct": 1,
        "explanation": "SIM swapping allows threat actors to impersonate your phone number and intercept SMS OTP codes.",
        "buff": {"name": "MFA Shield", "effect": "defense_up", "value": 25}
    },
    {
        "id": 3,
        "category": "Malware & Ransomware",
        "question": "A ransomware alert triggers on a developer's workstation at 2:00 AM. What is the very first step in the containment phase?",
        "options": [
            "Pay the ransom using corporate cryptocurrency wallet immediately",
            "Isolate the machine from the network (unplug ethernet / disable Wi-Fi)",
            "Run a disk defragmenter to clean infected sectors",
            "Reboot the machine into Safe Mode and continue coding"
        ],
        "correct": 1,
        "explanation": "Network isolation stops the ransomware from traversing laterally across internal subnets or encrypting network shares.",
        "buff": {"name": "Lateral Containment", "effect": "threat_meter", "value": 40}
    },
    {
        "id": 4,
        "category": "Application Security",
        "question": "An attacker inputs \"' OR '1'='1\" into a website's login box and bypasses authentication. What vulnerability did they exploit?",
        "options": [
            "Cross-Site Scripting (XSS)",
            "Buffer Overflow",
            "SQL Injection (SQLi)",
            "Distributed Denial of Service (DDoS)"
        ],
        "correct": 2,
        "explanation": "SQL Injection occurs when untrusted user input is directly concatenated into a database query string.",
        "buff": {"name": "Prepared Statements", "effect": "attack_up", "value": 20}
    },
    {
        "id": 5,
        "category": "Network Security",
        "question": "What is the concept of 'Zero Trust' security architecture primarily based upon?",
        "options": [
            "Never trust employees, always monitor their webcams",
            "Never trust, always verify every request regardless of network perimeter",
            "Block all incoming and outgoing internet traffic permanently",
            "Trust devices inside the corporate office LAN automatically"
        ],
        "correct": 1,
        "explanation": "Zero Trust assumes breaches will happen and strictly verifies every access request based on identity, context, and posture.",
        "buff": {"name": "Zero Trust Bastion", "effect": "damage_reduction", "value": 30}
    },
    {
        "id": 6,
        "category": "Cryptography",
        "question": "Which of the following is considered a one-way mathematical function used for password storage and integrity verification?",
        "options": [
            "AES-256 Symmetric Encryption",
            "Cryptographic Hash (e.g., Argon2, SHA-256)",
            "Base64 Encoding",
            "ROT13 Substitution"
        ],
        "correct": 1,
        "explanation": "Cryptographic hashes are one-way functions: easy to compute forward, practically impossible to invert.",
        "buff": {"name": "Argon2 Hardening", "effect": "guard_restore", "value": 40}
    },
    {
        "id": 7,
        "category": "Incident Response",
        "question": "During a suspected breach, why should forensic investigators avoid immediately powering off an active machine?",
        "options": [
            "Powering off the machine deletes all hard disk partitions",
            "Volatile memory (RAM) containing active processes and encryption keys will be lost",
            "The cooling fans must stay on to prevent CPU thermal throttling",
            "Operating systems cannot be rebooted after being switched off"
        ],
        "correct": 1,
        "explanation": "RAM holds volatile evidence such as active network sockets, injected malware binaries, and decrypted session keys.",
        "buff": {"name": "Live Memory Dump", "effect": "threat_meter", "value": 35}
    },
    {
        "id": 8,
        "category": "Cloud Security",
        "question": "In the Cloud Shared Responsibility Model, who is responsible for configuring access permissions and securing corporate customer data?",
        "options": [
            "The Cloud Service Provider (AWS / GCP / Azure) exclusively",
            "The Customer / Organization using the cloud service",
            "The Internet Service Provider (ISP)",
            "Local law enforcement authorities"
        ],
        "correct": 1,
        "explanation": "While CSPs secure the cloud infrastructure, customers are responsible for data security, IAM permissions, and access controls.",
        "buff": {"name": "IAM Least Privilege", "effect": "attack_up", "value": 25}
    },
    {
        "id": 9,
        "category": "Vulnerability Management",
        "question": "What is a 'Zero-Day Vulnerability'?",
        "options": [
            "A flaw discovered on the first day of every month",
            "A security flaw known to attackers before the vendor has issued a patch",
            "A software bug that causes an operating system to revert to zero files",
            "A vulnerability that takes zero seconds to exploit"
        ],
        "correct": 1,
        "explanation": "A Zero-Day is a flaw previously unknown to the software vendor, meaning zero days have passed since a fix was available.",
        "buff": {"name": "Zero-Day Exploit Ready", "effect": "threat_meter", "value": 50}
    },
    {
        "id": 10,
        "category": "Web Security",
        "question": "Which HTTP security header instructs web browsers to only communicate over encrypted HTTPS connections?",
        "options": [
            "Strict-Transport-Security (HSTS)",
            "Content-Security-Policy (CSP)",
            "X-Frame-Options",
            "Access-Control-Allow-Origin"
        ],
        "correct": 0,
        "explanation": "HSTS prevents SSL stripping attacks by forcing modern browsers to enforce HTTPS connections strictly.",
        "buff": {"name": "HSTS Shield", "effect": "guard_restore", "value": 45}
    }
]

def get_random_trivia():
    import random
    return random.choice(CYBER_TRIVIA)

ADDITIONAL_TRIVIA = [
    {
        "id": 11,
        "category": "Social Engineering",
        "question": "What is 'Tailgating' (or 'Piggybacking') in physical cybersecurity?",
        "options": [
            "Hacking a server through a car's Bluetooth network",
            "Following an authorized employee through a secure door without badging in",
            "Leaving corporate laptops inside a vehicle trunk",
            "Scanning barcodes from behind an employee at checkout"
        ],
        "correct": 1,
        "explanation": "Tailgating is a physical social engineering tactic where an unauthorized individual closely follows an authorized person into a restricted area.",
        "buff": {"name": "Physical Access Control", "effect": "defense_up", "value": 20}
    },
    {
        "id": 12,
        "category": "Network Security",
        "question": "Which protocol securely encapsulates DNS queries inside an encrypted HTTPS connection to prevent eavesdropping and DNS spoofing?",
        "options": [
            "DNSSEC",
            "DNS over HTTPS (DoH)",
            "SNMPv3",
            "FTP over SSL"
        ],
        "correct": 1,
        "explanation": "DoH encrypts DNS traffic within standard HTTPS port 443, preventing network snooping and man-in-the-middle manipulation.",
        "buff": {"name": "DoH Encrypted Tunnel", "effect": "guard_restore", "value": 35}
    },
    {
        "id": 13,
        "category": "Password Security",
        "question": "What is a 'Passphrase' and why is it recommended over a short complex password?",
        "options": [
            "A word spoken into a microphone to unlock Windows",
            "A sequence of random or meaningful words (e.g., 'correct-horse-battery-staple') that yields massive entropy and is easy to remember",
            "A password that expires every 2 hours",
            "A password generated strictly from musical lyrics"
        ],
        "correct": 1,
        "explanation": "Passphrases provide high mathematical entropy against brute-force attacks while remaining humanly memorable without frequent resets.",
        "buff": {"name": "High Entropy Buffer", "effect": "attack_up", "value": 25}
    },
    {
        "id": 14,
        "category": "AppSec",
        "question": "What type of attack involves injecting malicious client-side JavaScript into a web application viewed by other users?",
        "options": [
            "Cross-Site Scripting (XSS)",
            "Cross-Site Request Forgery (CSRF)",
            "Server-Side Template Injection (SSTI)",
            "Path Traversal"
        ],
        "correct": 0,
        "explanation": "XSS occurs when malicious scripts are injected into trusted websites and executed in unsuspecting users' browsers.",
        "buff": {"name": "Input Sanitization", "effect": "damage_reduction", "value": 30}
    },
    {
        "id": 15,
        "category": "DDoS Attacks",
        "question": "What is a SYN Flood attack targeting in the TCP three-way handshake?",
        "options": [
            "Exhausting server memory and connection tables by sending SYN packets without completing the ACK handshake",
            "Flooding network cables with high voltage electricity",
            "Overloading the DNS root servers with fake domain queries",
            "Injecting RST packets to disconnect video calls"
        ],
        "correct": 0,
        "explanation": "SYN Flood sends SYN requests and ignores the SYN-ACK responses, leaving half-open connections that exhaust system connection tables.",
        "buff": {"name": "SYN Cookie Mitigation", "effect": "threat_meter", "value": 45}
    }
]

CYBER_TRIVIA.extend(ADDITIONAL_TRIVIA)
