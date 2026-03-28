package main

import "fmt"

type Engine struct {
	HorsePower int
}

type Car struct {
	Model string
	Engine
}

func main() {
	myCar := Car{
		Model:  "Atenza",
		Engine: Engine{HorsePower: 200},
	}
	fmt.Println("Car Model:", myCar.Model)
	fmt.Println("Car HorsePower:", myCar.HorsePower)

}
