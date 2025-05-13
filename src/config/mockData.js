const services = {
    "1": "pe",
    "2": "unha"
};

const mockAvailability = {
    "pe": {
        "1": { day: "segunda", times: ["13:30", "15:00"] },
        "2": { day: "terça", times: ["13:30", "15:00"] },
        "3": { day: "quarta", times: ["13:30", "15:00"] },
    },
    "unha": {
        "1": { day: "segunda", times: ["10:00", "11:00"] },
        "2": { day: "terça", times: ["10:00", "11:00"] },
    }
};

module.exports = {
    services,
    mockAvailability
};