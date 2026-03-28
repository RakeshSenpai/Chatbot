const question = [
    {
        question: 'what will be 1 + 1',
        answer: [
            { text: '2' , guess: 'correct' },
            { text: '9' , guess: 'wrong' },
            { text: '6' , guess: 'wrong' },
        ]
    }
]

let currentQuestionIndex = 0
function showQuestion(){


    let html = ''
    question.forEach((q) => {
        const question = q.question 
        q.answer.forEach((a) => {
            const ans = a.text
            const opt = a.guess

            let htmlQuestion = `
            <div>${question}</div>
            <div>${ans}</div>
            <div>${opt}</div>
            `
            html += htmlQuestion
        })
    
    })

    document.querySelector('.container')
     .innerHTML = html
}

showQuestion()

const URL = 'https://opentdb.com/api.php?amount=30'
async function quiz() {
    const res = await fetch(URL)
    const data =  await res.json()
    console.log(data)
}

quiz()