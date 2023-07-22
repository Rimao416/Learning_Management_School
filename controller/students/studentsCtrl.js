const AysncHandler = require("express-async-handler");
const Student = require("../../model/Academic/Student");

const generateToken = require("../../utils/generateToken");
const { hashPassword, isPassMatched } = require("../../utils/helpers");
const Exam = require("../../model/Academic/Exam");
const ExamResult = require("../../model/Academic/ExamResults");

//@desc  Admin Register Student
//@route POST /api/students/admin/register
//@acess  Private Admin only

exports.adminRegisterStudent = AysncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  //check if teacher already exists
  const student = await Student.findOne({ email });
  if (student) {
    throw new Error("Student already employed");
  }
  //Hash password
  const hashedPassword = await hashPassword(password);
  // create
  const studentRegistered = await Student.create({
    name,
    email,
    password: hashedPassword,
  });
  //send student data
  res.status(201).json({
    status: "success",
    message: "Student registered successfully",
    data: studentRegistered,
  });
});

//@desc    login  student
//@route   POST /api/v1/students/login
//@access  Public

exports.loginStudent = AysncHandler(async (req, res) => {
  const { email, password } = req.body;
  //find the  user
  const student = await Student.findOne({ email });
  if (!student) {
    return res.json({ message: "Invalid login crendentials" });
  }
  //verify the password
  const isMatched = await isPassMatched(password, student?.password);
  if (!isMatched) {
    return res.json({ message: "Invalid login crendentials" });
  } else {
    res.status(200).json({
      status: "success",
      message: "Student logged in successfully",
      data: generateToken(student?._id),
    });
  }
});

//@desc    Student Profile
//@route   GET /api/v1/students/profile
//@access  Private Student only

exports.getStudentProfile = AysncHandler(async (req, res) => {
  const student = await Student.findById(req.userAuth?._id).select(
    "-password -createdAt -updatedAt"
  );
  if (!student) {
    throw new Error("Student not found");
  }
  res.status(200).json({
    status: "success",
    data: student,
    message: "Student Profile fetched  successfully",
  });
});

//@desc    Get all Students
//@route   GET /api/v1/admin/students
//@access  Private admin only

exports.getAllStudentsByAdmin = AysncHandler(async (req, res) => {
  const students = await Student.find();
  res.status(200).json({
    status: "success",
    message: "Students fetched successfully",
    data: students,
  });
});

//@desc    Get Single Student
//@route   GET /api/v1/students/:studentID/admin
//@access  Private admin only

exports.getStudentByAdmin = AysncHandler(async (req, res) => {
  const studentID = req.params.studentID;
  //find the teacher
  const student = await Student.findById(studentID);
  if (!student) {
    throw new Error("Student not found");
  }
  res.status(200).json({
    status: "success",
    message: "Student fetched successfully",
    data: student,
  });
});

//@desc    Student updating profile
//@route    UPDATE /api/v1/students/update
//@access   Private Student only

exports.studentUpdateProfile = AysncHandler(async (req, res) => {
  const { email, password } = req.body;
  //if email is taken
  const emailExist = await Student.findOne({ email });
  if (emailExist) {
    throw new Error("This email is taken/exist");
  }

  //hash password
  //check if user is updating password

  if (password) {
    //update
    const student = await Student.findByIdAndUpdate(
      req.userAuth._id,
      {
        email,
        password: await hashPassword(password),
      },
      {
        new: true,
        runValidators: true,
      }
    );
    res.status(200).json({
      status: "success",
      data: student,
      message: "Student updated successfully",
    });
  } else {
    //update
    const student = await Student.findByIdAndUpdate(
      req.userAuth._id,
      {
        email,
      },
      {
        new: true,
        runValidators: true,
      }
    );
    res.status(200).json({
      status: "success",
      data: student,
      message: "Student updated successfully",
    });
  }
});

//@desc     Admin updating Students eg: Assigning classes....
//@route    UPDATE /api/v1/students/:studentID/update/admin
//@access   Private Admin only

exports.adminUpdateStudent = AysncHandler(async (req, res) => {
  const { classLevels, academicYear, program, name, email, prefectName } =
    req.body;

  //find the student by id
  const studentFound = await Student.findById(req.params.studentID);
  if (!studentFound) {
    throw new Error("Student not found");
  }

  //update
  const studentUpdated = await Student.findByIdAndUpdate(
    req.params.studentID,
    {
      $set: {
        name,
        email,
        academicYear,
        program,
        prefectName,
      },
      $addToSet: {
        classLevels,
      },
    },
    {
      new: true,
    }
  );
  //send response
  res.status(200).json({
    status: "success",
    data: studentUpdated,
    message: "Student updated successfully",
  });
});

// @desc Student Taking Exams
// @ROUTE post /api/v1/exams/:examID/write
// @access Private Student only
exports.writeExam = AysncHandler(async (req, res) => {
  // get Student
  const student = await Student.findById(req.userAuth?._id);
  if (!student) {
    throw new Error("Student not found");
  }
  // Get Exam
  const exam = await Exam.findById(req.params.examID).populate("questions");
  if (!exam) {
    throw new Error("Exam not found");
  }
  const questions = exam?.questions;
  // get Students Answer
  const studentAnswers = req.body.answers;

  // check if student answered all questions
  if (studentAnswers.length !== questions.length) {
    throw new Error("Student must answered all questions");
  }

  //   Check if student has already taken the exams
  const studentFoundInResults = await ExamResult.findOne({
    student: student?._id,
  });
  if (studentFoundInResults) {
    throw new Error("Student has already taken the exam");
  }

  // Build Report Object
  let correctanswers = 0;
  let wrongAnswers = 0;
  let status = "";
  let grade = 0;
  let score = 0;
  let remarks = "";
  let answeredQuestions = [];
  // Check For Answers
  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    if (question.correctAnswer === studentAnswers[i]) {
      correctanswers++;
      score++;
      question.isCorrect = true;
    } else {
      wrongAnswers++;
    }
    // totalQuestion++;
  }

  totalQuestions = questions.length;
  grade = (correctanswers / questions.length) * 100;
  answeredQuestions = questions.map((question) => {
    return {
      question: question.question,
      correctAnswer: question.correctAnswer,
      isCorrect: question.isCorrect,
    };
  });

  // Calculate status
  // Calculate reports

  if (grade >= 50) {
    status = "passed";
  } else {
    status = "failed";
  }

  // Remarks
  if (grade >= 80) {
    remarks = "Excellent";
  } else if (grade >= 60) {
    remarks = "Good";
  } else {
    remarks = "Poor";
  }

  //   Generate Exam Results
  const examResults = await ExamResult.create({
    student: student?._id,
    exam: exam?._id,
    grade: grade,
    score: score,
    remarks: remarks,
    classLevels: exam?.classLevels,
    academicTerm: exam?.academicTerm,
    academicYear: exam?.academicYear,
  });

  // Publih the resulsts into
  student.examResults.push(examResults?._id);

  // sAVE
  await student.save();

  res.status(200).json({
    status: "success",
    correctanswers,
    wrongAnswers,
    score,
    questions,
    grade,
    answeredQuestions,
    status,
    remarks,
  });
});
