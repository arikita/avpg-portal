// Tự động chuyển hướng nếu người dùng truy cập từ tên miền cũ/local
if (window.location.hostname === 'local.anvietphatgroup.com') {
    window.location.replace('https://arikita.github.io/avpg-portal/');
}

// --- Form Toggle Logic ---
const signUpButton = document.getElementById('signUp');
const signInButton = document.getElementById('signIn');
const mainContainer = document.getElementById('container');

signUpButton.addEventListener('click', () => {
    mainContainer.classList.add("right-panel-active");
})

signInButton.addEventListener('click', () => {
    mainContainer.classList.remove("right-panel-active");
});

// --- Background Particle Effect Logic ---
const canvas = document.getElementById("canvas1");
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let particlesArray;

let mouse = {
    x: null,
    y: null,
    radius: (canvas.height / 80) * (canvas.width / 80)
}

window.addEventListener('mousemove',
    function (event) {
        mouse.x = event.x;
        mouse.y = event.y;
    }
);

window.addEventListener('resize',
    function () {
        canvas.width = innerWidth;
        canvas.height = innerHeight;
        mouse.radius = ((canvas.height / 80) * (canvas.height / 80));
        init();
    }
);

window.addEventListener('mouseout',
    function () {
        mouse.x = undefined;
        mouse.y = undefined;
    }
)

class Particle {
    constructor(x, y, directionX, directionY, size, color) {
        this.x = x;
        this.y = y;
        this.directionX = directionX;
        this.directionY = directionY;
        this.size = size;
        this.color = color;
    }
    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2, false);
        // RESTORED: Dark Gray particles so they are visible on light background
        ctx.fillStyle = '#8E9EAB';
        ctx.fill();
    }
    update() {
        if (this.x > canvas.width || this.x < 0) {
            this.directionX = -this.directionX;
        }
        if (this.y > canvas.height || this.y < 0) {
            this.directionY = -this.directionY;
        }

        let dx = mouse.x - this.x;
        let dy = mouse.y - this.y;
        let distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < mouse.radius + this.size) {
            if (mouse.x < this.x && this.x < canvas.width - this.size * 10) {
                this.x += 3;
            }
            if (mouse.x > this.x && this.x > this.size * 10) {
                this.x -= 3;
            }
            if (mouse.y < this.y && this.y < canvas.height - this.size * 10) {
                this.y += 3;
            }
            if (mouse.y > this.y && this.y > this.size * 10) {
                this.y -= 3;
            }
        }
        this.x += this.directionX;
        this.y += this.directionY;
        this.draw();
    }
}

function init() {
    particlesArray = [];
    let numberOfParticles = (canvas.height * canvas.width) / 9000;
    for (let i = 0; i < numberOfParticles * 2; i++) {
        let size = (Math.random() * 3) + 1;
        let x = (Math.random() * ((innerWidth - size * 2) - (size * 2)) + size * 2);
        let y = (Math.random() * ((innerHeight - size * 2) - (size * 2)) + size * 2);
        let directionX = (Math.random() * 2) - 1;
        let directionY = (Math.random() * 2) - 1;
        let color = '#8E9EAB';

        particlesArray.push(new Particle(x, y, directionX, directionY, size, color));
    }
}

function connect() {
    let opacityValue = 1;
    for (let a = 0; a < particlesArray.length; a++) {
        for (let b = a; b < particlesArray.length; b++) {
            let distance = ((particlesArray[a].x - particlesArray[b].x) * (particlesArray[a].x - particlesArray[b].x))
                + ((particlesArray[a].y - particlesArray[b].y) * (particlesArray[a].y - particlesArray[b].y));
            if (distance < (canvas.width / 7) * (canvas.height / 7)) {
                opacityValue = 1 - (distance / 20000);
                // RESTORED: Dark Gray connecting lines
                ctx.strokeStyle = 'rgba(142, 158, 171,' + opacityValue + ')';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(particlesArray[a].x, particlesArray[a].y);
                ctx.lineTo(particlesArray[b].x, particlesArray[b].y);
                ctx.stroke();
            }
        }
    }
}

function animate() {
    requestAnimationFrame(animate);
    ctx.clearRect(0, 0, innerWidth, innerHeight);

    for (let i = 0; i < particlesArray.length; i++) {
        particlesArray[i].update();
    }
    connect();
}

init();
animate();

// --- Modal Logic ---
const modal = document.getElementById("emailModal");
const btnFail = document.getElementById("btnFail");
const span = document.getElementsByClassName("close")[0];

// Các trường nhập liệu
const nameInput = document.getElementById("candidateName");
const genderInput = document.getElementById("candidateGender");
const positionInput = document.getElementById("candidatePosition");
const emailContent = document.getElementById("emailContent");
// Lấy danh sách các nút radio chọn mẫu
const templateRadios = document.getElementsByName("emailTemplate");

function updateEmailTemplate() {
    if (!emailContent) return;

    const name = nameInput.value.trim() || "[Họ và Tên]";
    const position = positionInput.value.trim() || "[Vị trí]";
    const gender = genderInput.value;

    let title = "Ms";
    let pronoun = "Anh/chị";

    if (gender === "Nam") {
        title = "Mr";
        pronoun = "Anh";
    } else if (gender === "Nữ") {
        title = "Ms";
        pronoun = "Chị";
    }

    // Kiểm tra mẫu nào đang được chọn
    let isTemplate2 = false;
    for (const radio of templateRadios) {
        if (radio.checked && radio.value === "template2") {
            isTemplate2 = true;
            break;
        }
    }

    // Nội dung chung
    const intro = `Dear ${title}. ${name}

Cảm ơn ${pronoun} đã dành thời gian tham gia phỏng vấn cho vị trí ${position}. 

Chúng tôi đánh giá cao sự cố gắng và nhiệt tình của ${pronoun} đối với Công Ty Cổ Phần Năng Lượng An Việt Phát cũng như những gì ${pronoun} thể hiện trong buổi phỏng vấn và cam kết đóng góp của ${pronoun} đối với mục tiêu của công ty.`;

    const outro = `Chúng tôi sẽ giữ lại hồ sơ của ${pronoun} và xin được liên hệ lại khi có bất kỳ một cơ hội nào phù hợp trong tương lai.

Chúc ${title}. ${name} may mắn trong quá trình tìm việc.

Trân trọng,`;

    // Nội dung riêng biệt
    const reason = isTemplate2 
        ? `Tuy nhiên, sau khi cân nhắc tổng thể giữa yêu cầu công việc và kinh nghiệm hiện tại của ${pronoun}. Chúng tôi nhận thấy hồ sơ của ${pronoun} chưa thực sự phù hợp với định hướng tuyển dụng ở thời điểm này.`
        : `Tuy nhiên, chúng tôi đã phỏng vấn một số ứng viên ấn tượng và quyết định đồng hành với họ tại thời điểm này. Chúng tôi đã cân nhắc rất nhiều trước khi đưa ra quyết định.`;

    emailContent.value = `${intro}\n\n${reason}\n\n${outro}`;
}

if (btnFail) {
    btnFail.addEventListener('click', (e) => {
        e.preventDefault(); // Ngăn form submit mặc định
        modal.style.display = "block";
        updateEmailTemplate(); // Cập nhật nội dung ngay khi mở
    });
}

if (span) {
    span.onclick = function() {
        modal.style.display = "none";
    }
}

// Xử lý sự kiện click nút "Gửi Email" để mở Outlook
const emailForm = document.getElementById("emailForm");
if (emailForm) {
    emailForm.addEventListener("submit", function(e) {
        e.preventDefault(); // Ngăn trình duyệt reload trang

        const recipient = document.getElementById("candidateEmail").value;
        const subject = document.getElementById("emailSubject").value;
        // Thay thế xuống dòng (\n) thành (\r\n) để Outlook hiển thị đúng khoảng cách
        const body = document.getElementById("emailContent").value.replace(/\n/g, "\r\n");

        // Tạo liên kết mailto để mở ứng dụng email mặc định (Outlook)
        const mailtoUrl = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

        // Sử dụng iframe ẩn và gán src trực tiếp để tránh lỗi window.open trên HTTPS
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
        iframe.src = mailtoUrl;
        
        setTimeout(() => {
            document.body.removeChild(iframe);
        }, 2000); // Tăng thời gian chờ để đảm bảo Outlook kịp nhận lệnh
    });
}

// Lắng nghe sự kiện thay đổi để cập nhật nội dung email
if (nameInput) nameInput.addEventListener('input', updateEmailTemplate);
if (genderInput) genderInput.addEventListener('change', updateEmailTemplate);
if (positionInput) positionInput.addEventListener('input', updateEmailTemplate);
// Lắng nghe sự kiện khi đổi mẫu email
templateRadios.forEach(radio => radio.addEventListener('change', updateEmailTemplate));

window.onclick = function(event) {
    if (event.target == modal) {
        modal.style.display = "none";
    }
}